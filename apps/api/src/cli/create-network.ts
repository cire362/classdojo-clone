/**
 * Сеть учреждений и её руководитель: округ, сеть школ, объединение колледжей, вуз с филиалами.
 *   docker compose exec api npm run create-network -- --name "Управление образования" --login uo --admin "Начальник" --schools id1,id2
 * Учреждения указываются по id (его печатает create-school). Добавить учреждения в существующую сеть:
 *   docker compose exec api npm run create-network -- --network <id сети> --schools id3
 * Руководитель сети видит только сводные показатели учреждений, без учеников и переписки.
 */
import { parseArgs } from 'node:util';
import { prisma } from '../platform/db.js';
import { LOGIN_PATTERN, generatePassword, hashPassword } from '../platform/credentials.js';

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    login: { type: 'string' },
    admin: { type: 'string' },
    schools: { type: 'string' },
    network: { type: 'string' },
  },
});
const schoolIds = (values.schools ?? '').split(',').map((s) => s.trim()).filter(Boolean);
try {
  const found = await prisma.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true, name: true } });
  const missing = schoolIds.filter((id) => !found.some((s) => s.id === id));
  if (missing.length) throw new Error(`Учреждения не найдены: ${missing.join(', ')}`);
  if (values.network) {
    const network = await prisma.network.findUnique({ where: { id: values.network } });
    if (!network) throw new Error('Сеть не найдена');
    await prisma.school.updateMany({ where: { id: { in: schoolIds } }, data: { networkId: network.id } });
    console.log(`В сеть «${network.name}» добавлено учреждений: ${found.length}`);
  } else {
    const name = values.name?.trim();
    const login = values.login?.trim().toLowerCase();
    if (!name || name.length > 120) throw new Error('Укажите --name: название сети, до 120 символов');
    if (!login || !LOGIN_PATTERN.test(login)) {
      throw new Error('Укажите --login руководителя: 3–64 символа, латиница, цифры, точка или дефис');
    }
    if (await prisma.account.findUnique({ where: { login } })) throw new Error(`Логин «${login}» уже занят`);
    const password = generatePassword();
    const network = await prisma.network.create({
      data: {
        name,
        schools: { connect: found.map((s) => ({ id: s.id })) },
        admins: {
          create: {
            name: values.admin?.trim() || 'Руководитель сети',
            account: { create: { login, passwordHash: await hashPassword(password), role: 'NETWORK' } },
          },
        },
      },
    });
    console.log(`Сеть создана: ${network.name} (id ${network.id}), учреждений: ${found.length}`);
    console.log(`Вход руководителя: ${login}\nПароль: ${password}\nСохраните пароль: повторно он не показывается.`);
  }
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
