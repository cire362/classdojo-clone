import type { Me } from '@heroes/shared/api';
import type { Context } from 'hono';
import { z } from 'zod';
import {
  ACCOUNT_PROFILE,
  accountInstitution,
  accountName,
  checkLoginRate,
  createSession,
  destroySession,
  resetLoginRate,
  type AuthUser,
} from '../../platform/auth.js';
import { prisma } from '../../platform/db.js';
import { hashPassword, verifyPassword } from '../../platform/credentials.js';
import { HttpError, parse } from '../../platform/errors.js';

export const NewPassword = z.string().min(8, 'Пароль должен быть не короче 8 символов').max(200);

const PasswordBody = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: NewPassword,
});

// Хеш-заглушка: при несуществующем логине всё равно тратим время на проверку,
// чтобы по времени ответа нельзя было узнать, есть ли такой логин
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('dummy-password-for-timing'));

/** Проверка логина и пароля; возвращает id аккаунта */
export async function checkCredentials(login: string, password: string): Promise<string> {
  const account = await prisma.account.findUnique({ where: { login } });
  const ok = await verifyPassword(account?.passwordHash ?? (await getDummyHash()), password);
  if (!account || !ok) throw new HttpError(401, 'Неверный логин или пароль');
  return account.id;
}

export async function accountView(accountId: string): Promise<Me> {
  const user = await prisma.account.findUniqueOrThrow({ where: { id: accountId }, include: ACCOUNT_PROFILE });
  const heroes = user.student ? { heroes: user.student.group.heroes } : {};
  return { login: user.login, role: user.role, name: accountName(user), institution: accountInstitution(user), ...heroes };
}

/** Вход без пароля (QR, код, приглашение): прежняя сессия этого браузера закрывается */
export async function signInAs(c: Context, accountId: string): Promise<Me> {
  await destroySession(c);
  await createSession(c, accountId);
  return accountView(accountId);
}

export async function renameTeacher(teacherId: string, name: string) {
  const t = await prisma.teacher.update({ where: { id: teacherId }, data: { name } });
  return { name: t.name };
}

/** Смена своего пароля: текущая сессия остаётся, на остальных устройствах выполняется выход */
export async function changeOwnPassword(user: AuthUser, body: unknown) {
  const { currentPassword, newPassword } = parse(PasswordBody, body);
  // Та же защита от перебора, что и при входе
  const rateKey = `password|${user.accountId}`;
  await checkLoginRate(rateKey);
  const account = await prisma.account.findUniqueOrThrow({ where: { id: user.accountId } });
  if (!(await verifyPassword(account.passwordHash, currentPassword))) {
    throw new HttpError(400, 'Текущий пароль указан неверно');
  }
  if (currentPassword === newPassword) throw new HttpError(400, 'Новый пароль совпадает с текущим');
  await resetLoginRate(rateKey);
  await prisma.$transaction([
    prisma.account.update({ where: { id: account.id }, data: { passwordHash: await hashPassword(newPassword) } }),
    prisma.session.deleteMany({ where: { accountId: account.id, id: { not: user.sessionId } } }),
  ]);
}
