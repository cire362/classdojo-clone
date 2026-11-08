import type { AdminGroup, AdminTeachers, SchoolInfo, TeacherCredentials } from '@heroes/shared/api';
import type { InstitutionKind } from '../../generated/prisma/client';
import type { AuthUser } from '../../platform/auth.js';
import { prisma } from '../../platform/db.js';
import { addDays, localDayStart } from '../../platform/dates.js';
import { env } from '../../platform/env.js';
import { generatePassword, hashPassword } from '../../platform/credentials.js';
import { HttpError, isUniqueViolation, notFound } from '../../platform/errors.js';
import { LOGIN_TAKEN, pendingTeacherCount } from './join.service.js';

/**
 * Администратор видит и меняет только свою школу: её преподавателей и группы, созданные ими.
 * Чужой преподаватель или группа отвечают 404, как несуществующие.
 */
/** Код подключения и заявки видят только директор и завуч: они их и проверяют */
export async function schoolInfo(user: AuthUser): Promise<SchoolInfo> {
  const select = { id: true, name: true, kind: true, heroes: true, joinCode: true } as const;
  const school = await prisma.school.findUniqueOrThrow({ where: { id: user.schoolId! }, select });
  const department = user.departmentId
    ? await prisma.department.findUnique({ where: { id: user.departmentId }, select: { id: true, name: true } })
    : null;
  // Код подключения и заявки — дело администрации всего учреждения
  const checks = user.schoolRole !== 'STAFF' && !user.departmentId;
  return {
    id: school.id,
    name: school.name,
    kind: school.kind,
    heroes: school.heroes,
    role: user.schoolRole!,
    joinCode: checks ? school.joinCode : null,
    pendingTeachers: checks ? await pendingTeacherCount(school.id) : 0,
    department,
  };
}

/**
 * Название, тип и героев учреждения меняет руководитель. Тип меняет слова интерфейса у всех его пользователей,
 * настройка героев применяется ко всем группам учреждения; дальше группу можно поменять отдельно
 */
export async function updateSchool(user: AuthUser, data: { name?: string; kind?: InstitutionKind; heroes?: boolean }): Promise<SchoolInfo> {
  await prisma.$transaction([
    prisma.school.update({ where: { id: user.schoolId! }, data }),
    ...(data.heroes === undefined
      ? []
      : [prisma.group.updateMany({ where: { teacher: { schoolId: user.schoolId! } }, data: { heroes: data.heroes } })]),
  ]);
  return schoolInfo(user);
}

export async function adminTeachers(schoolId: string): Promise<AdminTeachers> {
  const teachers = await prisma.teacher.findMany({
    where: { schoolId, pendingSince: null },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: {
      id: true, name: true, disabledAt: true, account: { select: { login: true } },
      _count: { select: { groups: true, coGroups: true } },
    },
  });
  return {
    teachers: teachers.map((t) => ({
      id: t.id,
      name: t.name,
      login: t.account.login,
      ownedGroups: t._count.groups,
      sharedGroups: t._count.coGroups,
      disabled: !!t.disabledAt,
    })),
  };
}

export async function createTeacher(schoolId: string, name: string, login: string): Promise<TeacherCredentials> {
  const password = generatePassword();
  try {
    const teacher = await prisma.teacher.create({
      data: {
        name,
        school: { connect: { id: schoolId } },
        account: { create: { login, role: 'TEACHER', passwordHash: await hashPassword(password) } },
      },
      select: { id: true },
    });
    return { id: teacher.id, name, login, password };
  } catch (err) {
    // Уникальность проверяет БД, в том числе при двух одновременных запросах.
    if (isUniqueViolation(err)) throw new HttpError(409, LOGIN_TAKEN);
    throw err;
  }
}

export async function resetTeacherPassword(schoolId: string, teacherId: string): Promise<TeacherCredentials> {
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, schoolId, pendingSince: null },
    select: { id: true, name: true, accountId: true, account: { select: { login: true } } },
  });
  if (!teacher) throw notFound('Преподаватель не найден');
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  // Старый пароль и все старые сессии перестают работать вместе.
  await prisma.$transaction([
    prisma.account.update({ where: { id: teacher.accountId }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { accountId: teacher.accountId } }),
  ]);
  return { id: teacher.id, name: teacher.name, login: teacher.account.login, password };
}

/** Доступ до конца выбранного дня в часовом поясе школы */
