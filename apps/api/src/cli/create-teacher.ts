/**
 * Создание преподавателя из командной строки:
 *   npm run create-teacher -w @heroes/api -- --login ivanova --name "Анна Ивановна" [--password секрет]
 * В docker:
 *   docker compose exec api npm run create-teacher -- --login ivanova --name "Анна Ивановна"
 * Если пароль не указан, он будет сгенерирован и выведен один раз.
 * С флагом --reset меняет пароль существующему преподавателю.
 */
import { parseArgs } from 'node:util';
import { prisma } from '../db.js';
import { LOGIN_PATTERN, generatePassword, hashPassword } from '../lib/credentials.js';

const { values } = parseArgs({
  options: {
    login: { type: 'string' },
    name: { type: 'string' },
    password: { type: 'string' },
    reset: { type: 'boolean', default: false },
  },
});

const login = values.login?.trim().toLowerCase();
if (!login || !LOGIN_PATTERN.test(login)) {
  console.error('Укажите --login (латиница, цифры, точка, дефис; от 3 до 64 символов)');
  process.exit(1);
}
const password = values.password ?? generatePassword();
if (password.length < 8) {
  console.error('Пароль должен быть не короче 8 символов');
  process.exit(1);
}

const existing = await prisma.account.findUnique({ where: { login }, include: { teacher: true } });
if (existing) {
  if (!values.reset || !existing.teacher) {
    console.error(`Логин «${login}» уже занят. Для смены пароля преподавателю добавьте --reset`);
    process.exit(1);
  }
  await prisma.account.update({ where: { id: existing.id }, data: { passwordHash: await hashPassword(password) } });
  await prisma.session.deleteMany({ where: { accountId: existing.id } });
  console.log(`Пароль преподавателя «${login}» изменён.`);
} else {
  const name = values.name?.trim();
  if (!name) {
    console.error('Укажите --name');
    process.exit(1);
  }
  await prisma.teacher.create({
    data: { name, account: { create: { login, passwordHash: await hashPassword(password), role: 'TEACHER' } } },
  });
  console.log(`Преподаватель создан: ${name}, логин «${login}».`);
}
if (!values.password) console.log(`Пароль: ${password}  (сохраните его: повторно пароль не показывается)`);
await prisma.$disconnect();
