/** Первый администратор: npm run create-admin -- --login director --name "Директор" [--reset] */
import { parseArgs } from 'node:util';
import { prisma } from '../db.js';
import { LOGIN_PATTERN, generatePassword, hashPassword } from '../lib/credentials.js';

const { values } = parseArgs({ options: {
  login: { type: 'string' }, name: { type: 'string' }, reset: { type: 'boolean', default: false },
} });
const login = values.login?.trim().toLowerCase();
const name = values.name?.trim();
try {
  if (!login || !LOGIN_PATTERN.test(login)) throw new Error('Укажите --login: 3–64 символа, латиница, цифры, точка или дефис');
  const account = await prisma.account.findUnique({ where: { login } });
  if (account && (!values.reset || account.role !== 'ADMIN')) throw new Error('Логин занят. Для сброса пароля администратора добавьте --reset');
  if (!account && (!name || name.length > 80)) throw new Error('Укажите --name: от 1 до 80 символов');
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  if (account) {
    await prisma.$transaction([
      prisma.account.update({ where: { id: account.id }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { accountId: account.id } }),
    ]);
  } else {
    await prisma.admin.create({ data: { name: name!, account: { create: { login, passwordHash, role: 'ADMIN' } } } });
  }
  console.log(`Вход администратора: ${login}\nПароль: ${password}\nСохраните пароль: повторно он не показывается.`);
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
