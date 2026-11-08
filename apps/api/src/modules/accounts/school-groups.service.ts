import type { AdminGroup } from '@heroes/shared/api';
import type { AuthUser } from '../../platform/auth.js';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { adminGroupsWhere, departmentSubtree } from '../access/index.js';
import { filesExpireAt } from '../files/index.js';

/**
 * Группы учреждения в панели администрации: всё учреждение или только подразделение сотрудника.
 * Подразделение, курс и специальность группе задаёт директор или заместитель; сотрудник подразделения —
 * только своим группам и только внутри своего подразделения
 */
export async function adminGroups(user: AuthUser): Promise<AdminGroup[]> {
  const groups = await prisma.group.findMany({
    where: await adminGroupsWhere(user),
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: {
      id: true, name: true, archivedAt: true, course: true, specialty: true,
      department: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true, account: { select: { login: true } } } },
      coTeachers: { orderBy: { createdAt: 'asc' }, select: { teacher: { select: { id: true, name: true } } } },
      _count: { select: { students: true } },
    },
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    archivedAt: g.archivedAt?.toISOString() ?? null,
    filesExpireAt: filesExpireAt(g.archivedAt)?.toISOString() ?? null,
    department: g.department,
    course: g.course,
    specialty: g.specialty,
    owner: { id: g.teacher.id, name: g.teacher.name, login: g.teacher.account.login },
    colleagues: g.coTeachers.map((t) => t.teacher),
    studentsCount: g._count.students,
  }));
}

export async function updateAdminGroup(
  user: AuthUser,
  groupId: string,
  data: { departmentId: string | null; course: number | null; specialty: string },
): Promise<AdminGroup[]> {
  if (user.schoolRole === 'STAFF') throw new HttpError(403, 'Это может сделать только директор или заместитель');
  const where = await adminGroupsWhere(user);
  if (!(await prisma.group.count({ where: { ...where, id: groupId } }))) throw notFound('Группа не найдена');
  if (data.departmentId) {
    const department = await prisma.department.findFirst({ where: { id: data.departmentId, schoolId: user.schoolId! } });
    if (!department) throw notFound('Подразделение не найдено');
  }
  // Сотрудник подразделения не выводит группу из своего подразделения
  if (user.departmentId && !(data.departmentId && (await departmentSubtree(user.departmentId)).includes(data.departmentId))) {
    throw new HttpError(403, 'Группу можно перенести только внутри вашего подразделения');
  }
  await prisma.group.update({ where: { id: groupId }, data });
  return adminGroups(user);
}
