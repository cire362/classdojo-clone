import { z } from 'zod';
import { checkLoginRate, resetLoginRate, type AuthUser } from '../platform/auth.js';
import { prisma } from '../platform/db.js';
import { hashPassword, verifyPassword } from '../platform/credentials.js';
import { HttpError, parse } from '../platform/errors.js';

const PasswordBody = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8, 'Пароль должен быть не короче 8 символов').max(200),
});

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
