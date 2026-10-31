import { randomHero } from '@heroes/shared';
import { prisma } from '../platform/db.js';
import { deleteOrphanParents } from '../modules/parents/index.js';
import { generatePassword, hashPassword, loginBase, pickLogin } from '../platform/credentials.js';

export interface IssuedCredentials {
  id: string;
  name: string;
  login: string;
  /** Пароль в открытом виде — возвращается только один раз, в БД хранится хеш */
  password: string;
}

async function takenLogins(bases: string[]): Promise<Set<string>> {
  const unique = [...new Set(bases)];
  const rows = await prisma.account.findMany({
    where: { OR: unique.map((b) => ({ login: { startsWith: b } })) },
    select: { login: true },
  });
  return new Set(rows.map((r) => r.login));
}

export async function createStudents(groupId: string, names: string[]): Promise<IssuedCredentials[]> {
  const clean = names.map((n) => n.trim().replace(/\s+/g, ' ')).filter(Boolean);
  const bases = clean.map(loginBase);
  const taken = await takenLogins(bases);

  const prepared = await Promise.all(
    clean.map(async (name, i) => {
      const login = pickLogin(bases[i], taken);
      taken.add(login);
      const password = generatePassword();
      return { name, login, password, passwordHash: await hashPassword(password) };
    }),
  );

  const created = await prisma.$transaction(
    prepared.map((p) =>
      prisma.student.create({
        data: {
          name: p.name,
          group: { connect: { id: groupId } },
          account: { create: { login: p.login, passwordHash: p.passwordHash, role: 'STUDENT' } },
          hero: { create: { parts: randomHero() } },
        },
      }),
    ),
  );
  return created.map((s, i) => ({ id: s.id, name: s.name, login: prepared[i].login, password: prepared[i].password }));
}

/** Новый пароль для ученика; все его активные сессии завершаются */
export async function resetStudentPassword(studentId: string): Promise<IssuedCredentials> {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { account: true } });
  const password = generatePassword();
  await prisma.$transaction([
    prisma.account.update({ where: { id: student.accountId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.session.deleteMany({ where: { accountId: student.accountId } }),
  ]);
  return { id: student.id, name: student.name, login: student.account.login, password };
}

export async function deleteStudent(studentId: string): Promise<void> {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
  // Удаление аккаунта каскадом удаляет ученика, героя, баллы и посещаемость
  await prisma.$transaction([prisma.account.delete({ where: { id: student.accountId } }), deleteOrphanParents()]);
}
