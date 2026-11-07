/**
 * Новая школа со своим директором:
 *   npm run create-school -w @heroes/api -- --name "Гимназия № 5" --login gym5 --admin "Директор"
 * В docker:
 *   docker compose exec api npm run create-school -- --name "Гимназия № 5" --login gym5 --admin "Директор"
 * Преподавателей и администрацию школы дальше добавляет её директор. Данные разных школ друг другу не видны.
 */
import { parseArgs } from 'node:util';
import { prisma } from '../platform/db.js';
import { LOGIN_PATTERN, generatePassword, hashPassword } from '../platform/credentials.js';

const { values } = parseArgs({ options: { name: { type: 'string' }, login: { type: 'string' }, admin: { type: 'string' } } });
const name = values.name?.trim();
const login = values.login?.trim().toLowerCase();
const adminName = values.admin?.trim() || 'Администратор';
try {
  if (!name || name.length > 120) throw new Error('Укажите --name: название школы, до 120 символов');
  if (!login || !LOGIN_PATTERN.test(login)) {
    throw new Error('Укажите --login администратора: 3–64 символа, латиница, цифры, точка или дефис');
  }
  if (await prisma.account.findUnique({ where: { login } })) throw new Error(`Логин «${login}» уже занят`);
  const password = generatePassword();
  const school = await prisma.school.create({
    data: {
      name,
      admins: { create: { name: adminName, account: { create: { login, passwordHash: await hashPassword(password), role: 'ADMIN' } } } },
    },
  });
  console.log(`Школа создана: ${school.name} (id ${school.id})\nВход администратора: ${login}\nПароль: ${password}`);
  console.log('Сохраните пароль: повторно он не показывается.');
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
