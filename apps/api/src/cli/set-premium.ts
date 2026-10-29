/**
 * Премиум для преподавателя (платежей пока нет, срок ставит администратор):
 *   npm run set-premium -w @heroes/api -- --login ivanova --until 2027-06-30
 *   npm run set-premium -w @heroes/api -- --login ivanova --off
 * В docker:
 *   docker compose exec api npm run set-premium -- --login ivanova --until 2027-06-30
 */
import { parseArgs } from 'node:util';
import { prisma } from '../db.js';

const { values } = parseArgs({
  options: {
    login: { type: 'string' },
    until: { type: 'string' },
    off: { type: 'boolean', default: false },
  },
});

const login = values.login?.trim().toLowerCase();
const teacher = login ? await prisma.teacher.findFirst({ where: { account: { login } } }) : null;
if (!teacher) {
  console.error('Укажите --login существующего преподавателя');
  process.exit(1);
}

let premiumUntil: Date | null = null;
if (!values.off) {
  // Действует до конца указанного дня
  const until = values.until && /^\d{4}-\d{2}-\d{2}$/.test(values.until) ? new Date(`${values.until}T23:59:59`) : null;
  if (!until || Number.isNaN(until.getTime()) || until < new Date()) {
    console.error('Укажите --until ГГГГ-ММ-ДД (дата в будущем) или --off');
    process.exit(1);
  }
  premiumUntil = until;
}

await prisma.teacher.update({ where: { id: teacher.id }, data: { premiumUntil } });
console.log(premiumUntil ? `Премиум для «${login}» до ${values.until}` : `Премиум для «${login}» отключён`);
await prisma.$disconnect();
