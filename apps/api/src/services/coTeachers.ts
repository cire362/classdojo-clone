import { prisma } from '../platform/db.js';
import { HttpError, notFound } from '../platform/errors.js';

const MAX_CO_TEACHERS = 10;

/** Преподаватели группы: владелец и соавторы */
export async function groupTeachers(groupId: string, me: string) {
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    include: {
      teacher: { include: { account: { select: { login: true } } } },
      coTeachers: { orderBy: { createdAt: 'asc' }, include: { teacher: { include: { account: { select: { login: true } } } } } },
    },
  });
  const view = (t: { id: string; name: string; account: { login: string } }) => ({ id: t.id, name: t.name, login: t.account.login, isMe: t.id === me });
  return {
    owner: view(group.teacher),
    coTeachers: group.coTeachers.map((ct) => view(ct.teacher)),
  };
}

/** Добавить коллегу по логину. Аккаунты преподавателей создаёт администратор (create-teacher) */
export async function addCoTeacher(group: { id: string; teacherId: string }, login: string) {
  const teacher = await prisma.teacher.findFirst({ where: { account: { login, role: 'TEACHER' } } });
  if (!teacher) throw notFound('Преподаватель с таким логином не найден');
  if (teacher.id === group.teacherId) throw new HttpError(400, 'Это создатель группы');
  const exists = await prisma.groupTeacher.findUnique({ where: { groupId_teacherId: { groupId: group.id, teacherId: teacher.id } } });
  if (exists) throw new HttpError(409, 'Этот преподаватель уже в группе');
  if ((await prisma.groupTeacher.count({ where: { groupId: group.id } })) >= MAX_CO_TEACHERS) {
    throw new HttpError(400, `В группе может быть не больше ${MAX_CO_TEACHERS} соавторов`);
  }
  await prisma.groupTeacher.create({ data: { groupId: group.id, teacherId: teacher.id } });
}

export async function removeCoTeacher(groupId: string, teacherId: string) {
  const { count } = await prisma.groupTeacher.deleteMany({ where: { groupId, teacherId } });
  if (!count) throw notFound('Преподаватель не найден в группе');
}
