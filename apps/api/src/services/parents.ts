import { levelForPoints, normalizeHero } from '@heroes/shared';
import { prisma } from '../platform/db.js';
import { generatePassword, hashPassword, loginBase, pickLogin } from '../platform/credentials.js';
import { HttpError, notFound } from '../platform/errors.js';
import { groupsOf } from '../modules/access/index.js';

/**
 * Родители. Аккаунты создаёт преподаватель (регистрации нет), как и для учеников.
 * Один родительский вход может быть привязан к нескольким детям; родитель видит только их.
 */
export interface ParentCredentials {
  parentId: string;
  /** Для кого выдан доступ — подпись на листе для печати */
  studentId: string;
  studentName: string;
  login: string;
  /** Пароль в открытом виде — возвращается только один раз, в БД хранится хеш */
  password: string;
}

/** «Маша Иванова» → parent.masha.i (при совпадении parent.masha.i2 …) */
async function freeParentLogins(names: string[]): Promise<string[]> {
  const bases = names.map((n) => `parent.${loginBase(n)}`);
  const rows = await prisma.account.findMany({
    where: { OR: [...new Set(bases)].map((b) => ({ login: { startsWith: b } })) },
    select: { login: true },
  });
  const taken = new Set(rows.map((r) => r.login));
  return bases.map((b) => {
    const login = pickLogin(b, taken);
    taken.add(login);
    return login;
  });
}

export async function createParents(students: { id: string; name: string }[]): Promise<ParentCredentials[]> {
  const logins = await freeParentLogins(students.map((s) => s.name));
  const prepared = await Promise.all(
    students.map(async (s, i) => {
      const password = generatePassword();
      return { student: s, login: logins[i], password, passwordHash: await hashPassword(password) };
    }),
  );
  const created = await prisma.$transaction(
    prepared.map((p) =>
      prisma.parent.create({
        data: {
          account: { create: { login: p.login, passwordHash: p.passwordHash, role: 'PARENT' } },
          children: { create: { studentId: p.student.id } },
        },
      }),
    ),
  );
  return created.map((parent, i) => ({
    parentId: parent.id,
    studentId: prepared[i].student.id,
    studentName: prepared[i].student.name,
    login: prepared[i].login,
    password: prepared[i].password,
  }));
}

export async function studentParents(studentId: string) {
  const links = await prisma.parentStudent.findMany({
    where: { studentId },
    orderBy: { createdAt: 'asc' },
    include: {
      parent: {
        include: {
          account: { select: { login: true } },
          children: { include: { student: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  return links.map(({ parent }) => ({
    id: parent.id,
    login: parent.account.login,
    // Остальные дети этого родителя (братья и сёстры), чтобы преподаватель видел общий вход
    otherChildren: parent.children.filter((ch) => ch.studentId !== studentId).map((ch) => ch.student),
  }));
}

/**
 * Родитель, которого видит преподаватель: привязан хотя бы к одному его ученику.
 * Чужие родители выглядят как несуществующие (404), как и чужие ученики.
 */
async function teacherParent(teacherId: string, where: { id: string } | { login: string }) {
  const parent = await prisma.parent.findFirst({
    where: {
      ...('id' in where ? { id: where.id } : { account: { login: where.login } }),
      children: { some: { student: { group: groupsOf(teacherId) } } },
    },
    include: { account: true },
  });
  if (!parent) throw notFound('Родитель не найден');
  return parent;
}

/** Привязать уже выданный родительский вход ещё к одному ребёнку (брат или сестра) */
export async function linkParent(teacherId: string, studentId: string, login: string) {
  const parent = await teacherParent(teacherId, { login: login.trim().toLowerCase() });
  const exists = await prisma.parentStudent.findUnique({ where: { parentId_studentId: { parentId: parent.id, studentId } } });
  if (exists) throw new HttpError(409, 'Этот родитель уже привязан к ученику');
  const count = await prisma.parentStudent.count({ where: { parentId: parent.id } });
  if (count >= 10) throw new HttpError(400, 'К одному родителю можно привязать не больше 10 детей');
  await prisma.parentStudent.create({ data: { parentId: parent.id, studentId } });
}

/** Отвязать родителя от ученика. Если детей у родителя не осталось — его вход удаляется */
export async function unlinkParent(teacherId: string, studentId: string, parentId: string) {
  await teacherParent(teacherId, { id: parentId });
  const { count } = await prisma.parentStudent.deleteMany({ where: { parentId, studentId } });
  if (!count) throw notFound('Родитель не привязан к ученику');
  const left = await prisma.parentStudent.count({ where: { parentId } });
  if (!left) await deleteOrphanParents();
}

/** Удаляет входы родителей, у которых не осталось детей (после удаления учеников или группы) */
export function deleteOrphanParents() {
  return prisma.account.deleteMany({ where: { role: 'PARENT', parent: { children: { none: {} } } } });
}

/** Новый пароль родителю; все его сессии завершаются */
export async function resetParentPassword(teacherId: string, parentId: string, studentId: string) {
  const parent = await teacherParent(teacherId, { id: parentId });
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { id: true, name: true } });
  const password = generatePassword();
  await prisma.$transaction([
    prisma.account.update({ where: { id: parent.accountId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.session.deleteMany({ where: { accountId: parent.accountId } }),
  ]);
  return { parentId, studentId: student.id, studentName: student.name, login: parent.account.login, password };
}

/** Дети родителя — для его кабинета */
export async function parentChildren(parentId: string) {
  const links = await prisma.parentStudent.findMany({
    where: { parentId },
    include: {
      student: {
        include: {
          hero: true,
          group: { select: { name: true } },
          pointEvents: { where: { value: { gt: 0 } }, select: { value: true } },
        },
      },
    },
    orderBy: { student: { name: 'asc' } },
  });
  return links.map(({ student: s }) => ({
    id: s.id,
    name: s.name,
    groupId: s.groupId,
    groupName: s.group.name,
    hero: { name: s.hero?.name ?? '', parts: normalizeHero(s.hero?.parts) },
    level: levelForPoints(s.pointEvents.reduce((sum, e) => sum + e.value, 0)).level,
  }));
}
