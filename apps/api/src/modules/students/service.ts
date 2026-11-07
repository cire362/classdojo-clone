import { randomHero } from '@heroes/shared';
import type { Credentials } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';
import { revokeLoginCard } from '../codes/index.js';
import { deleteOrphanParents } from '../parents/index.js';
import { generatePassword, hashPassword, loginBase, pickLogin } from '../../platform/credentials.js';
import { HttpError } from '../../platform/errors.js';
import { previewImport } from './import.js';
import { terms } from '../../platform/terms.js';
import { cap } from '@heroes/shared/terms';

const MAX_GROUP_STUDENTS = 200;
const fullGroup = () => `В группе может быть не больше ${MAX_GROUP_STUDENTS} ${terms().student.many.gen}`;

async function takenLogins(bases: string[]): Promise<Set<string>> {
  const unique = [...new Set(bases)];
  const rows = await prisma.account.findMany({
    where: { OR: unique.map((b) => ({ login: { startsWith: b } })) },
    select: { login: true },
  });
  return new Set(rows.map((r) => r.login));
}

export async function createStudents(groupId: string, names: string[]): Promise<Credentials[]> {
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

/** Пустые строки отбрасываются; пароль возвращается только один раз, в БД хранится хеш */
export async function addStudents(groupId: string, names: string[]): Promise<Credentials[]> {
  const clean = names.filter(Boolean);
  if (!clean.length) throw new HttpError(400, 'Введите хотя бы одно имя');
  const total = await prisma.student.count({ where: { groupId } });
  if (total + clean.length > MAX_GROUP_STUDENTS) throw new HttpError(400, fullGroup());
  return createStudents(groupId, clean);
}

/** Разбор Excel/CSV со списком учеников: только предпросмотр, создание — обычным addStudents */
export async function importPreview(groupId: string, file: File) {
  const preview = await previewImport(file);
  const existing = await prisma.student.findMany({ where: { groupId }, select: { name: true } });
  const have = new Set(existing.map((s) => s.name.toLowerCase()));
  return { ...preview, names: preview.names.map((name) => ({ name, alreadyInGroup: have.has(name.toLowerCase()) })) };
}

export async function updateStudent(studentId: string, data: { name?: string; noPhotos?: boolean }) {
  const s = await prisma.student.update({ where: { id: studentId }, data });
  return { id: s.id, name: s.name, noPhotos: s.noPhotos };
}

/**
 * Перевод в другую группу этого же преподавателя: герой, баллы, история и логин остаются при ученике,
 * прошлые отметки посещаемости остаются в старой группе
 */
export async function moveStudent(student: { id: string; groupId: string }, target: { id: string; name: string }) {
  if (target.id === student.groupId) throw new HttpError(400, `${cap(terms().student.one.nom)} уже в этой группе`);
  const total = await prisma.student.count({ where: { groupId: target.id } });
  if (total >= MAX_GROUP_STUDENTS) throw new HttpError(400, fullGroup());
  // Команды принадлежат группе: в новой ученик начинает без команды
  await prisma.student.update({ where: { id: student.id }, data: { groupId: target.id, teamId: null } });
  return { id: student.id, groupId: target.id, groupName: target.name };
}

/** Новые пароли группе или выбранным ученикам */
export async function resetGroupPasswords(groupId: string, studentIds?: string[]): Promise<Credentials[]> {
  const students = await prisma.student.findMany({
    where: { groupId, ...(studentIds ? { id: { in: studentIds } } : {}) },
    orderBy: { name: 'asc' },
    select: { id: true },
  });
  const credentials = [];
  for (const s of students) credentials.push(await resetStudentPassword(s.id));
  return credentials;
}

/** Новый пароль для ученика; все его активные сессии и QR-карточка перестают работать */
export async function resetStudentPassword(studentId: string): Promise<Credentials> {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { account: true } });
  const password = generatePassword();
  await prisma.$transaction([
    prisma.account.update({ where: { id: student.accountId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.session.deleteMany({ where: { accountId: student.accountId } }),
    // Пароль меняют, когда вход ушёл в чужие руки: карточка не должна его сохранять
    revokeLoginCard(student.id),
  ]);
  return { id: student.id, name: student.name, login: student.account.login, password };
}

export async function deleteStudent(studentId: string): Promise<void> {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
  // Удаление аккаунта каскадом удаляет ученика, героя, баллы и посещаемость
  await prisma.$transaction([prisma.account.delete({ where: { id: student.accountId } }), deleteOrphanParents()]);
}
