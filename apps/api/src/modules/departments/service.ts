import type { Department } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';

/**
 * Подразделения колледжа или вуза: отделение, факультет или институт, а внутри факультета — кафедры.
 * Глубже одного уровня не вкладываются: так область видимости декана считается одним запросом.
 */
export async function schoolDepartments(schoolId: string): Promise<Department[]> {
  const rows = await prisma.department.findMany({
    where: { schoolId },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, parentId: true, _count: { select: { groups: true, admins: true } } },
  });
  return rows.map((d) => ({ id: d.id, name: d.name, parentId: d.parentId, groups: d._count.groups, admins: d._count.admins }));
}

async function checkParent(schoolId: string, parentId: string | null, selfId?: string) {
  if (!parentId) return;
  const parent = await prisma.department.findFirst({ where: { id: parentId, schoolId }, select: { parentId: true } });
  if (!parent) throw notFound('Подразделение не найдено');
  if (parent.parentId || parentId === selfId) throw new HttpError(400, 'Подразделения вкладываются только на один уровень');
}

export async function createDepartment(schoolId: string, data: { name: string; parentId: string | null }) {
  await checkParent(schoolId, data.parentId);
  await prisma.department.create({ data: { schoolId, name: data.name, parentId: data.parentId } });
  return schoolDepartments(schoolId);
}

export async function updateDepartment(schoolId: string, id: string, data: { name: string; parentId: string | null }) {
  const current = await prisma.department.findFirst({ where: { id, schoolId }, select: { _count: { select: { children: true } } } });
  if (!current) throw notFound('Подразделение не найдено');
  if (data.parentId && current._count.children) throw new HttpError(400, 'Подразделение с кафедрами нельзя вложить в другое');
  await checkParent(schoolId, data.parentId, id);
  await prisma.department.update({ where: { id }, data });
  return schoolDepartments(schoolId);
}

/**
 * Удалить можно подразделение без вложенных и без закреплённых сотрудников: иначе сотрудник подразделения
 * незаметно получил бы права на всё учреждение. Группы остаются, только без подразделения
 */
export async function deleteDepartment(schoolId: string, id: string) {
  const current = await prisma.department.findFirst({
    where: { id, schoolId },
    select: { _count: { select: { children: true, admins: true } } },
  });
  if (!current) throw notFound('Подразделение не найдено');
  if (current._count.children) throw new HttpError(409, 'Сначала удалите или перенесите вложенные подразделения');
  if (current._count.admins) throw new HttpError(409, 'К подразделению закреплены сотрудники: сначала перенесите их');
  await prisma.department.delete({ where: { id } });
  return schoolDepartments(schoolId);
}
