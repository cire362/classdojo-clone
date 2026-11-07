/**
 * Новое учебное заведение со своим руководителем:
 *   npm run create-school -w @heroes/api -- --name "Гимназия № 5" --login gym5 --admin "Директор"
 * В docker:
 *   docker compose exec api npm run create-school -- --name "Гимназия № 5" --login gym5 --admin "Директор"
 * Тип: --type school (по умолчанию), college (колледж или техникум) или university (вуз). Он задаёт слова интерфейса:
 *   docker compose exec api npm run create-school -- --type university --name "Политех" --login poly --admin "Ректор"
 * Преподавателей и администрацию школы дальше добавляет её директор. Данные разных школ друг другу не видны.
 */
import { parseArgs } from 'node:util';
import { prisma } from '../platform/db.js';
import { LOGIN_PATTERN, generatePassword, hashPassword } from '../platform/credentials.js';

const KINDS = { school: 'SCHOOL', college: 'COLLEGE', university: 'UNIVERSITY' } as const;
const { values } = parseArgs({
  options: { name: { type: 'string' }, login: { type: 'string' }, admin: { type: 'string' }, type: { type: 'string', default: 'school' } },
});
const name = values.name?.trim();
const login = values.login?.trim().toLowerCase();
const adminName = values.admin?.trim() || 'Администратор';
try {
  const kind = KINDS[values.type as keyof typeof KINDS];
  if (!kind) throw new Error('Укажите --type: school, college или university');
  if (!name || name.length > 120) throw new Error('Укажите --name: название школы, до 120 символов');
  if (!login || !LOGIN_PATTERN.test(login)) {
    throw new Error('Укажите --login администратора: 3–64 символа, латиница, цифры, точка или дефис');
  }
  if (await prisma.account.findUnique({ where: { login } })) throw new Error(`Логин «${login}» уже занят`);
  const password = generatePassword();
  const school = await prisma.school.create({
    data: {
      name,
      kind,
      heroes: kind !== 'UNIVERSITY',
      admins: { create: { name: adminName, account: { create: { login, passwordHash: await hashPassword(password), role: 'ADMIN' } } } },
    },
  });
  console.log(`Учреждение создано: ${school.name} (id ${school.id})\nВход руководителя: ${login}\nПароль: ${password}`);
  console.log('Сохраните пароль: повторно он не показывается.');
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
