import type { ImportPlan, ImportResult, TeacherCredentials } from '@heroes/shared/api';
import { loginBase, pickLogin } from '../../platform/credentials.js';
import { prisma } from '../../platform/db.js';
import { HttpError } from '../../platform/errors.js';
import { terms } from '../../platform/terms.js';
import { createTeacher } from '../accounts/index.js';
import { createGroup } from '../groups/index.js';
import { createStudents, MAX_GROUP_STUDENTS } from '../students/index.js';
import type { ImportRow } from './parse.js';

/**
 * Импорт учреждения одним файлом: подразделения, группы с курсом и специальностью, преподаватели и ученики.
 * Сначала строится план (ничего не создаётся), администрация его смотрит и применяет тем же файлом.
 * Существующие группы дополняются новыми учениками, существующие преподаватели находятся по логину или имени.
 */
const key = (s: string) => s.toLocaleLowerCase('ru');

export async function buildPlan(schoolId: string, rows: ImportRow[]): Promise<ImportPlan> {
  const [departments, groups, teachers] = await Promise.all([
    prisma.department.findMany({ where: { schoolId }, select: { name: true } }),
    prisma.group.findMany({
      where: { teacher: { schoolId }, archivedAt: null },
      select: { name: true, teacher: { select: { name: true } }, students: { select: { name: true } } },
    }),
    prisma.teacher.findMany({
      where: { schoolId, pendingSince: null, disabledAt: null },
      select: { id: true, name: true, account: { select: { login: true } } },
    }),
  ]);
  const knownDepartments = new Set(departments.map((d) => key(d.name)));
  const existingGroups = new Map(groups.map((g) => [key(g.name), g]));
  const byLogin = new Map(teachers.map((t) => [t.account.login, t]));
  const byName = new Map<string, (typeof teachers)[number] | null>();
  for (const t of teachers) byName.set(key(t.name), byName.has(key(t.name)) ? null : t);
  const errors: ImportPlan['errors'] = [];
  const planned = new Map<string, ImportPlan['groups'][number] & { names: Set<string> }>();
  const newTeachers = new Map<string, { name: string; login: string }>();
  const newDepartments = new Map<string, string>();

  const loginTaken = async (login: string) => !!(await prisma.account.findUnique({ where: { login }, select: { id: true } }));
  const taken = new Set<string>();

  for (const row of rows) {
    if (!row.group) {
      errors.push({ line: row.line, message: 'Не указана группа' });
      continue;
    }
    let g = planned.get(key(row.group));
    if (!g) {
      const existing = existingGroups.get(key(row.group));
      g = {
        name: row.group,
        exists: !!existing,
        department: row.department,
        course: row.course,
        specialty: row.specialty,
        teacher: existing ? { name: existing.teacher.name, login: '', exists: true } : { name: '', login: '', exists: false },
        students: existing?.students.length ?? 0,
        newStudents: [],
        names: new Set(existing?.students.map((s) => key(s.name)) ?? []),
      };
      planned.set(key(row.group), g);
    }
    if (!g.exists && !g.teacher.name && (row.teacher || row.teacherLogin)) {
      const found = (row.teacherLogin && byLogin.get(row.teacherLogin)) || (row.teacher ? byName.get(key(row.teacher)) : undefined);
      if (found) g.teacher = { name: found.name, login: found.account.login, exists: true };
      else if (!row.teacher) errors.push({ line: row.line, message: `Преподаватель с логином ${row.teacherLogin} не найден` });
      else {
        const already = newTeachers.get(key(row.teacher));
        let login = already?.login ?? row.teacherLogin;
        if (!login) {
          const base = loginBase(row.teacher);
          while (!login) {
            const candidate = pickLogin(base, taken);
            taken.add(candidate);
            if (!(await loginTaken(candidate))) login = candidate;
          }
        } else if (!already && (await loginTaken(login))) {
          errors.push({ line: row.line, message: `Логин ${login} уже занят` });
        }
        newTeachers.set(key(row.teacher), { name: row.teacher, login });
        g.teacher = { name: row.teacher, login, exists: false };
      }
    }
    if (g.department && !knownDepartments.has(key(g.department))) newDepartments.set(key(g.department), g.department);
    if (row.student && !g.names.has(key(row.student))) {
      g.names.add(key(row.student));
      g.newStudents.push(row.student);
      if (g.students + g.newStudents.length > MAX_GROUP_STUDENTS) {
        errors.push({ line: row.line, message: `В группе «${g.name}» больше ${MAX_GROUP_STUDENTS} ${terms().student.many.gen}` });
      }
    }
  }
  for (const g of planned.values()) {
    if (!g.exists && !g.teacher.name) errors.push({ line: 0, message: `У новой группы «${g.name}» не указан преподаватель` });
  }
  return {
    departments: [...newDepartments.values()],
    teachers: [...newTeachers.values()],
    groups: [...planned.values()].map(({ names: _names, ...g }) => g),
    errors: errors.slice(0, 50),
  };
}

export async function applyPlan(schoolId: string, plan: ImportPlan): Promise<ImportResult> {
  if (plan.errors.length) throw new HttpError(422, 'Исправьте ошибки в файле и загрузите его снова');
  for (const name of plan.departments) await prisma.department.create({ data: { schoolId, name } });
  const departments = new Map(
    (await prisma.department.findMany({ where: { schoolId }, select: { id: true, name: true } })).map((d) => [key(d.name), d.id]),
  );
  const credentials: TeacherCredentials[] = [];
  for (const t of plan.teachers) credentials.push(await createTeacher(schoolId, t.name, t.login));
  const teacherIds = new Map(
    (await prisma.teacher.findMany({ where: { schoolId }, select: { id: true, account: { select: { login: true } } } }))
      .map((t) => [t.account.login, t.id]),
  );
  let students = 0;
  let created = 0;
  for (const g of plan.groups) {
    let groupId: string;
    if (g.exists) {
      const found = await prisma.group.findFirst({
        where: { teacher: { schoolId }, archivedAt: null, name: { equals: g.name, mode: 'insensitive' } },
      });
      if (!found) continue;
      groupId = found.id;
    } else {
      groupId = (await createGroup(teacherIds.get(g.teacher.login)!, g.name)).id;
      created += 1;
    }
    const data = {
      ...(g.department ? { departmentId: departments.get(key(g.department)) ?? null } : {}),
      ...(g.course ? { course: g.course } : {}),
      ...(g.specialty ? { specialty: g.specialty } : {}),
    };
    if (Object.keys(data).length) await prisma.group.update({ where: { id: groupId }, data });
    if (g.newStudents.length) students += (await createStudents(groupId, g.newStudents)).length;
  }
  return { teachers: credentials, groups: created, students };
}
