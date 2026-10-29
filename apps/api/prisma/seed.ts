/**
 * Тестовые данные: преподаватель, группа из 10 учеников, причины по умолчанию
 * и немного истории за последние две недели. Скрипт идемпотентен: если
 * преподаватель уже есть, ничего не меняется (кроме синхронизации деталей героев).
 */
import { randomHero } from '@heroes/shared';
import { prisma } from '../src/db.js';
import { hashPassword, loginBase, pickLogin } from '../src/lib/credentials.js';
import { addDays, dateKey, dbDate, startOfDay } from '../src/lib/dates.js';
import { syncHeroParts } from '../src/services/heroParts.js';
import { attendanceReason, createDefaultReasons } from '../src/services/reasons.js';
import { createDefaultRewards } from '../src/services/rewards.js';

const TEACHER_LOGIN = process.env.SEED_TEACHER_LOGIN ?? 'teacher';
const TEACHER_PASSWORD = process.env.SEED_TEACHER_PASSWORD ?? 'teacher123';
const STUDENT_PASSWORD = process.env.SEED_STUDENT_PASSWORD ?? 'hero12345';
const PARENT_LOGIN = 'parent';
const PARENT_PASSWORD = process.env.SEED_PARENT_PASSWORD ?? 'parent12345';
/** Демо-родитель с двумя детьми — чтобы было видно переключение между детьми */
const PARENT_CHILDREN = ['kira.m', 'mark.o'];

const NAMES = [
  'Алиса Морозова',
  'Артём Ковалёв',
  'Вера Соколова',
  'Глеб Новиков',
  'Дарья Лебедева',
  'Егор Павлов',
  'Злата Волкова',
  'Илья Фёдоров',
  'Кира Михайлова',
  'Марк Орлов',
];

// Детерминированный генератор — одинаковые демо-данные при каждом чистом запуске
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const CO_TEACHER_LOGIN = 'teacher2';

/** Второй преподаватель — соавтор демо-группы; добавляется и в уже существующую демо-базу */
async function ensureDemoCoTeacher() {
  if (await prisma.account.findUnique({ where: { login: CO_TEACHER_LOGIN } })) return;
  const group = await prisma.group.findFirst({ where: { teacher: { account: { login: TEACHER_LOGIN } } }, orderBy: { createdAt: 'asc' } });
  if (!group) return;
  await prisma.teacher.create({
    data: {
      name: 'Игорь Павлович',
      account: { create: { login: CO_TEACHER_LOGIN, passwordHash: await hashPassword(TEACHER_PASSWORD), role: 'TEACHER' } },
      coGroups: { create: { groupId: group.id } },
    },
  });
  console.log(`Seed: соавтор группы «${group.name}»: ${CO_TEACHER_LOGIN} / ${TEACHER_PASSWORD}`);
}

/** Демо-родитель добавляется и в уже существующую демо-базу (роль появилась позже) */
async function ensureDemoParent() {
  if (await prisma.account.findUnique({ where: { login: PARENT_LOGIN } })) return;
  const children = await prisma.student.findMany({ where: { account: { login: { in: PARENT_CHILDREN } } }, select: { id: true } });
  if (!children.length) return;
  await prisma.parent.create({
    data: {
      account: { create: { login: PARENT_LOGIN, passwordHash: await hashPassword(PARENT_PASSWORD), role: 'PARENT' } },
      children: { create: children.map((c) => ({ studentId: c.id })) },
    },
  });
  console.log(`Seed: родитель ${PARENT_LOGIN} / ${PARENT_PASSWORD} (дети: ${PARENT_CHILDREN.join(', ')})`);
}

/** Награды по умолчанию — и в уже существующей демо-группе (магазин появился позже) */
async function ensureDemoRewards() {
  const group = await prisma.group.findFirst({ where: { teacher: { account: { login: TEACHER_LOGIN } } }, orderBy: { createdAt: 'asc' } });
  if (group && !(await prisma.reward.count({ where: { groupId: group.id } }))) await createDefaultRewards(prisma, group.id);
}

async function ensureDemoAdmin() {
  const login = process.env.SEED_ADMIN_LOGIN ?? 'admin';
  if (await prisma.account.findUnique({ where: { login } })) return;
  await prisma.admin.create({ data: {
    name: 'Администратор школы',
    account: { create: { login, role: 'ADMIN', passwordHash: await hashPassword(process.env.SEED_ADMIN_PASSWORD ?? 'admin12345') } },
  } });
}

async function main() {
  await syncHeroParts();
  await ensureDemoAdmin();

  if (await prisma.account.findUnique({ where: { login: TEACHER_LOGIN } })) {
    console.log(`Seed: преподаватель «${TEACHER_LOGIN}» уже есть — пропускаю.`);
    await ensureDemoParent();
    await ensureDemoCoTeacher();
    await ensureDemoRewards();
    return;
  }

  const teacher = await prisma.teacher.create({
    data: {
      name: 'Анна Сергеевна',
      account: { create: { login: TEACHER_LOGIN, passwordHash: await hashPassword(TEACHER_PASSWORD), role: 'TEACHER' } },
    },
  });
  const group = await prisma.group.create({ data: { name: '5 «А»', teacherId: teacher.id } });
  await createDefaultReasons(prisma, group.id);

  const studentHash = await hashPassword(STUDENT_PASSWORD);
  const taken = new Set((await prisma.account.findMany({ select: { login: true } })).map((a) => a.login));
  const createStudent = (name: string, login: string) =>
    prisma.student.create({
          data: {
          name,
          group: { connect: { id: group.id } },
          account: { create: { login, passwordHash: studentHash, role: 'STUDENT' as const } },
          hero: { create: { parts: randomHero(rand) } },
        },
        include: { account: true },
      });
  const students: Awaited<ReturnType<typeof createStudent>>[] = [];
  for (const name of NAMES) {
    const login = pickLogin(loginBase(name), taken);
    taken.add(login);
    students.push(await createStudent(name, login));
  }

  // Демо-история: 6 уроков за две недели, посещаемость и баллы
  const reasons = await prisma.behaviorReason.findMany({ where: { groupId: group.id, kind: 'MANUAL' } });
  const plus = reasons.filter((r) => r.value > 0);
  const minus = reasons.filter((r) => r.value < 0);
  const attendance = await attendanceReason(prisma, group.id);
  const today = startOfDay();
  for (const daysAgo of [13, 11, 8, 6, 4, 1]) {
    const day = addDays(today, -daysAgo);
    const lessonTime = (min: number) => new Date(day.getTime() + (10 * 60 + min) * 60_000);
    const present = students.filter(() => rand() > 0.12);
    const session = await prisma.attendanceSession.create({
      data: {
        groupId: group.id,
        date: dbDate(dateKey(day)),
        peopleOnPhoto: present.length + 1,
        subtractedTeacher: true,
        studentsTotal: students.length,
        createdById: teacher.accountId,
        records: { create: students.map((s) => ({ studentId: s.id, present: present.includes(s) })) },
      },
    });
    for (const s of present) {
      const events = [{ r: attendance, min: 0 }];
      const n = Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) events.push({ r: plus[Math.floor(rand() * plus.length)], min: 5 + i * 10 });
      if (rand() < 0.15) events.push({ r: minus[Math.floor(rand() * minus.length)], min: 30 });
      await prisma.pointEvent.createMany({
        data: events.map(({ r, min }) => ({
          studentId: s.id,
          reasonId: r.id,
          reasonName: r.name,
          emoji: r.emoji,
          value: r.value,
          createdAt: lessonTime(min),
          awardedById: teacher.accountId,
          helpBadge: r.value > 0 && r.countsForHelpBadge,
          awardedGroupId: group.id,
          attendanceSessionId: r.kind === 'ATTENDANCE' ? session.id : null,
        })),
      });
    }
  }

  console.log('Seed: тестовые данные созданы.');
  console.log(`  Преподаватель: ${TEACHER_LOGIN} / ${TEACHER_PASSWORD}`);
  console.log(`  Группа «${group.name}», пароль у всех учеников: ${STUDENT_PASSWORD}`);
  for (const s of students) console.log(`    ${s.name.padEnd(18)} ${s.account.login}`);
  await ensureDemoParent();
  await ensureDemoCoTeacher();
  await ensureDemoRewards();
}

await main();
await prisma.$disconnect();
