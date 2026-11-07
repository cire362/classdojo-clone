import { randomBytes, randomInt } from 'node:crypto';
import { normalizeHero } from '@heroes/shared';
import type { ClassCode, ClassRoster, LoginCard } from '@heroes/shared/api';
import { sha256 } from '../../platform/auth.js';
import { prisma } from '../../platform/db.js';
import { HttpError } from '../../platform/errors.js';

const CARD_DAYS = 90;
const CLASS_CODE_MINUTES = 45;
const CODE_LENGTH = 6;
/** Без похожих друг на друга I, L, O, 0 и 1: код переписывают с экрана */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const BAD_CODE = 'Код не подошёл. Попроси преподавателя показать его ещё раз';

/** «Маша Иванова» → «Маша И.»: список виден всем, кто знает код */
const shortName = (name: string) => {
  const [first, last] = name.split(' ');
  return last ? `${first} ${last[0]}.` : first;
};

/** Новая карточка заменяет старую: так преподаватель сбрасывает потерянную */
export async function issueLoginCards(groupId: string, studentIds?: string[]): Promise<LoginCard[]> {
  const students = await prisma.student.findMany({
    where: { groupId, ...(studentIds ? { id: { in: studentIds } } : {}) },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  const expiresAt = new Date(Date.now() + CARD_DAYS * 24 * 3600 * 1000);
  const cards = students.map((s) => ({ studentId: s.id, name: s.name, token: randomBytes(32).toString('base64url') }));
  await prisma.$transaction(cards.map(({ studentId, token }) => {
    const data = { tokenHash: sha256(token), expiresAt, createdAt: new Date() };
    return prisma.loginCard.upsert({ where: { studentId }, create: { studentId, ...data }, update: data });
  }));
  return cards.map((card) => ({ ...card, expiresAt: expiresAt.toISOString() }));
}

/** Запрос, а не действие: выполняется в одной транзакции со сменой пароля */
export const revokeLoginCard = (studentId: string) => prisma.loginCard.deleteMany({ where: { studentId } });

/** Вход по карточке; возвращает id аккаунта ученика */
export async function cardAccount(token: string): Promise<string> {
  const card = await prisma.loginCard.findUnique({
    where: { tokenHash: sha256(token) },
    select: { expiresAt: true, student: { select: { accountId: true } } },
  });
  if (!card || card.expiresAt <= new Date()) throw new HttpError(400, BAD_CODE);
  return card.student.accountId;
}

export async function activeClassCode(groupId: string): Promise<ClassCode | null> {
  const found = await prisma.classCode.findFirst({ where: { groupId, expiresAt: { gt: new Date() } } });
  return found && { code: found.code, expiresAt: found.expiresAt.toISOString() };
}

function randomCode() {
  return Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

export async function createClassCode(groupId: string): Promise<ClassCode> {
  const expiresAt = new Date(Date.now() + CLASS_CODE_MINUTES * 60_000);
  for (let attempt = 0; ; attempt++) {
    const code = randomCode();
    try {
      await prisma.classCode.upsert({ where: { groupId }, create: { groupId, code, expiresAt }, update: { code, expiresAt } });
      return { code, expiresAt: expiresAt.toISOString() };
    } catch (err) {
      // Совпадение с кодом другой группы: пробуем другой
      const duplicate = typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
      if (!duplicate || attempt === 4) throw err;
    }
  }
}

export async function removeClassCode(groupId: string) {
  await prisma.classCode.deleteMany({ where: { groupId } });
}

async function validGroup(code: string) {
  const found = await prisma.classCode.findUnique({
    where: { code: code.trim().toUpperCase() },
    select: { expiresAt: true, group: { select: { id: true, name: true, archivedAt: true } } },
  });
  if (!found || found.expiresAt <= new Date() || found.group.archivedAt) throw new HttpError(400, BAD_CODE);
  return found.group;
}

export async function classRoster(code: string): Promise<ClassRoster> {
  const group = await validGroup(code);
  const students = await prisma.student.findMany({
    where: { groupId: group.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, hero: { select: { name: true, parts: true } } },
  });
  return {
    groupName: group.name,
    students: students.map((s) => ({
      id: s.id,
      name: shortName(s.name),
      hero: { name: s.hero?.name ?? '', parts: normalizeHero(s.hero?.parts) },
    })),
  };
}

/** Вход по коду класса; возвращает id аккаунта выбранного ученика */
export async function classCodeAccount(code: string, studentId: string): Promise<string> {
  const group = await validGroup(code);
  const student = await prisma.student.findFirst({ where: { id: studentId, groupId: group.id }, select: { accountId: true } });
  if (!student) throw new HttpError(400, BAD_CODE);
  return student.accountId;
}
