import { randomInt } from 'node:crypto';
import type { ActiveInvite, InvitePreview, ParentInvite } from '@heroes/shared/api';
import type { Prisma } from '../../generated/prisma/client';
import { sha256 } from '../../platform/auth.js';
import { hashPassword } from '../../platform/credentials.js';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { lockStudent } from '../access/index.js';
import { MAX_PARENT_CHILDREN, MAX_STUDENT_PARENTS, TOO_MANY_CHILDREN, TOO_MANY_PARENTS, freeParentLogins } from './service.js';

const INVITE_DAYS = 14;
const CODE_LENGTH = 10;
/** Без похожих друг на друга I, L, O, 0 и 1: код могут продиктовать или переписать с листа */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const BAD_INVITE = 'Приглашение не подошло или устарело. Попросите преподавателя выдать новое';

/** Код считается с разделителем, как на листе, но проверяется без него */
const normalize = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

function newCode() {
  return Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

const expiry = () => new Date(Date.now() + INVITE_DAYS * 24 * 3600 * 1000);

export async function activeInvites(studentId: string): Promise<ActiveInvite[]> {
  const rows = await prisma.parentInvite.findMany({
    where: { studentId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, expiresAt: true },
  });
  return rows.map((r) => ({ id: r.id, expiresAt: r.expiresAt.toISOString() }));
}

/** Приглашений и выданных входов вместе не больше лимита: иначе лишнее приглашение откажет родителю уже у него на экране */
export async function createInvite(student: { id: string; name: string }): Promise<ParentInvite> {
  const code = newCode();
  const invite = await prisma.$transaction(async (tx) => {
    await lockStudent(tx, student.id);
    const parents = await tx.parentStudent.count({ where: { studentId: student.id } });
    const invites = await tx.parentInvite.count({ where: { studentId: student.id, expiresAt: { gt: new Date() } } });
    if (parents + invites >= MAX_STUDENT_PARENTS) throw new HttpError(400, TOO_MANY_PARENTS);
    return tx.parentInvite.create({ data: { studentId: student.id, codeHash: sha256(code), expiresAt: expiry() } });
  });
  return { id: invite.id, studentId: student.id, studentName: student.name, code, expiresAt: invite.expiresAt.toISOString() };
}

/** Лист на собрание: ученикам без входа родителей. Прежние приглашения заменяются, их коды показать повторно нельзя */
export async function createGroupInvites(groupId: string): Promise<ParentInvite[]> {
  const students = await prisma.student.findMany({
    where: { groupId, parents: { none: {} } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  const expiresAt = expiry();
  const prepared = students.map((s) => ({ ...s, code: newCode() }));
  const created = await prisma.$transaction([
    prisma.parentInvite.deleteMany({ where: { studentId: { in: students.map((s) => s.id) } } }),
    ...prepared.map((s) => prisma.parentInvite.create({ data: { studentId: s.id, codeHash: sha256(s.code), expiresAt } })),
  ]);
  return prepared.map((s, i) => ({
    id: (created[i + 1] as { id: string }).id,
    studentId: s.id,
    studentName: s.name,
    code: s.code,
    expiresAt: expiresAt.toISOString(),
  }));
}

export async function revokeInvite(studentId: string, inviteId: string) {
  const { count } = await prisma.parentInvite.deleteMany({ where: { id: inviteId, studentId } });
  if (!count) throw notFound('Приглашение не найдено');
}

async function findInvite(code: string) {
  const invite = await prisma.parentInvite.findUnique({
    where: { codeHash: sha256(normalize(code)) },
    select: {
      id: true,
      studentId: true,
      expiresAt: true,
      student: { select: { name: true, group: { select: { name: true, archivedAt: true } } } },
    },
  });
  if (!invite || invite.expiresAt <= new Date() || invite.student.group.archivedAt) throw new HttpError(400, BAD_INVITE);
  return invite;
}

export async function previewInvite(code: string): Promise<InvitePreview> {
  const invite = await findInvite(code);
  return { studentName: invite.student.name, groupName: invite.student.group.name };
}

/** Приглашение одноразовое: списание внутри транзакции, поэтому два открытых окна не создадут два входа */
async function spendInvite(tx: Prisma.TransactionClient, invite: { id: string; studentId: string }) {
  await lockStudent(tx, invite.studentId);
  const { count } = await tx.parentInvite.deleteMany({ where: { id: invite.id, expiresAt: { gt: new Date() } } });
  if (!count) throw new HttpError(400, BAD_INVITE);
}

/** Родитель сам задаёт пароль; логин выдаётся автоматически и показывается ему на экране */
export async function acceptInvite(code: string, password: string) {
  const invite = await findInvite(code);
  const passwordHash = await hashPassword(password);
  const [login] = await freeParentLogins([invite.student.name]);
  try {
    const parent = await prisma.$transaction(async (tx) => {
      await spendInvite(tx, invite);
      if ((await tx.parentStudent.count({ where: { studentId: invite.studentId } })) >= MAX_STUDENT_PARENTS) {
        throw new HttpError(400, TOO_MANY_PARENTS);
      }
      return tx.parent.create({
        data: {
          account: { create: { login, passwordHash, role: 'PARENT' } },
          children: { create: { studentId: invite.studentId } },
        },
        select: { accountId: true },
      });
    });
    return { accountId: parent.accountId, login };
  } catch (err) {
    // Логин успел занять другой родитель с таким же именем ученика; приглашение не потрачено
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      throw new HttpError(409, 'Не получилось создать вход. Нажмите кнопку ещё раз');
    }
    throw err;
  }
}

/** Уже есть вход: приглашение добавляет брата или сестру к нему */
export async function addChildByInvite(parentId: string, code: string): Promise<InvitePreview> {
  const invite = await findInvite(code);
  await prisma.$transaction(async (tx) => {
    await spendInvite(tx, invite);
    const link = { parentId_studentId: { parentId, studentId: invite.studentId } };
    if (await tx.parentStudent.findUnique({ where: link })) throw new HttpError(409, 'Этот ребёнок уже привязан к вашему входу');
    if ((await tx.parentStudent.count({ where: { parentId } })) >= MAX_PARENT_CHILDREN) throw new HttpError(400, TOO_MANY_CHILDREN);
    if ((await tx.parentStudent.count({ where: { studentId: invite.studentId } })) >= MAX_STUDENT_PARENTS) {
      throw new HttpError(400, TOO_MANY_PARENTS);
    }
    await tx.parentStudent.create({ data: { parentId, studentId: invite.studentId } });
  });
  return { studentName: invite.student.name, groupName: invite.student.group.name };
}
