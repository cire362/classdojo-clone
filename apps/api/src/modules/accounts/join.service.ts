import { randomInt } from 'node:crypto';
import type { SchoolJoinPreview, TeacherRequest } from '@heroes/shared/api';
import { hashPassword } from '../../platform/credentials.js';
import { prisma } from '../../platform/db.js';
import { HttpError, isUniqueViolation, notFound } from '../../platform/errors.js';
import { lockSchool } from '../access/index.js';

/**
 * Подключение преподавателя по коду школы. Код выдаёт директор или завуч, преподаватель сам задаёт
 * имя, логин и пароль, но войти может только после проверки администрацией. Отклонённая заявка удаляется.
 */
const CODE_LENGTH = 8;
/** Без похожих друг на друга I, L, O, 0 и 1: код диктуют на педсовете или переписывают с листа */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** Ждущих заявок в одной школе не больше: код мог утечь, и заявки не должны копиться без конца */
export const MAX_PENDING_TEACHERS = 30;
export const LOGIN_TAKEN = 'Этот логин уже занят. Выберите другой';
const BAD_CODE = 'Код школы не подошёл. Проверьте его или попросите новый у администрации школы';

export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');
const newCode = () => Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/** Новый код вместо прежнего: старый сразу перестаёт работать */
export async function renewJoinCode(schoolId: string): Promise<string> {
  for (;;) {
    const joinCode = newCode();
    try {
      await prisma.school.update({ where: { id: schoolId }, data: { joinCode } });
      return joinCode;
    } catch (err) {
      // Совпадение с кодом другой школы крайне маловероятно, но уникальность проверяет БД
      if (!isUniqueViolation(err)) throw err;
    }
  }
}

export async function disableJoinCode(schoolId: string) {
  await prisma.school.update({ where: { id: schoolId }, data: { joinCode: null } });
}

async function schoolByCode(code: string) {
  const joinCode = normalizeCode(code);
  const school = joinCode.length === CODE_LENGTH ? await prisma.school.findUnique({ where: { joinCode } }) : null;
  if (!school) throw new HttpError(404, BAD_CODE);
  return school;
}

export async function previewJoin(code: string): Promise<SchoolJoinPreview> {
  return { schoolName: (await schoolByCode(code)).name };
}

export async function joinSchool(input: { code: string; name: string; login: string; password: string }): Promise<SchoolJoinPreview> {
  const school = await schoolByCode(input.code);
  const passwordHash = await hashPassword(input.password);
  try {
    await prisma.$transaction(async (tx) => {
      await lockSchool(tx, school.id);
      if ((await tx.teacher.count({ where: { schoolId: school.id, pendingSince: { not: null } } })) >= MAX_PENDING_TEACHERS) {
        throw new HttpError(409, 'В школе слишком много непроверенных заявок. Попросите администрацию сначала их разобрать');
      }
      await tx.teacher.create({
        data: {
          name: input.name,
          pendingSince: new Date(),
          school: { connect: { id: school.id } },
          account: { create: { login: input.login, role: 'TEACHER', passwordHash } },
        },
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, LOGIN_TAKEN);
    throw err;
  }
  return { schoolName: school.name };
}

export async function teacherRequests(schoolId: string): Promise<TeacherRequest[]> {
  const rows = await prisma.teacher.findMany({
    where: { schoolId, pendingSince: { not: null } },
    orderBy: [{ pendingSince: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, pendingSince: true, account: { select: { login: true } } },
  });
  return rows.map((t) => ({ id: t.id, name: t.name, login: t.account.login, createdAt: t.pendingSince!.toISOString() }));
}

export async function approveTeacher(schoolId: string, teacherId: string) {
  const { count } = await prisma.teacher.updateMany({
    where: { id: teacherId, schoolId, pendingSince: { not: null } },
    data: { pendingSince: null },
  });
  if (!count) throw notFound('Заявка не найдена');
  return teacherRequests(schoolId);
}

/** Отклонённая заявка удаляется вместе со входом: логин освобождается */
export async function rejectTeacher(schoolId: string, teacherId: string) {
  const { count } = await prisma.account.deleteMany({ where: { teacher: { id: teacherId, schoolId, pendingSince: { not: null } } } });
  if (!count) throw notFound('Заявка не найдена');
  return teacherRequests(schoolId);
}

export const pendingTeacherCount = (schoolId: string) => prisma.teacher.count({ where: { schoolId, pendingSince: { not: null } } });

/** Вход до проверки закрыт: пароль уже проверен, поэтому ответ ничего не раскрывает постороннему */
export async function ensureVerified(accountId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { accountId },
    select: { pendingSince: true, school: { select: { name: true } } },
  });
  if (teacher?.pendingSince) {
    throw new HttpError(403, `Заявка на подключение к школе «${teacher.school.name}» ещё ждёт проверки. Войти можно будет после неё`);
  }
}
