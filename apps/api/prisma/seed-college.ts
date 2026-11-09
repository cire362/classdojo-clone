/**
 * Демо-колледж — главная аудитория продукта: студенты СПО. Отделение, группа второго курса со специальностью,
 * куратор и преподаватель дисциплины, три дисциплины и две недели пар с посещаемостью и баллами.
 * Идемпотентно: если директор колледжа уже есть, ничего не меняется.
 */
import { randomHero } from '@heroes/shared';
import { prisma } from '../src/platform/db.js';
import { hashPassword, loginBase, pickLogin } from '../src/platform/credentials.js';
import { addDays, dateKey, dbDate, startOfDay } from '../src/platform/dates.js';
import { attendanceReason, createDefaultReasons } from '../src/modules/reasons/index.js';
import { createDefaultRewards } from '../src/modules/rewards/index.js';

const DIRECTOR_LOGIN = 'college';
const DIRECTOR_PASSWORD = process.env.SEED_COLLEGE_PASSWORD ?? 'college12345';
const CURATOR_LOGIN = 'kurator';
const LECTURER_LOGIN = 'prepod';

const STUDENTS = [
  'Анастасия Белова',
  'Богдан Зайцев',
  'Валерия Киселёва',
  'Даниил Громов',
  'Екатерина Попова',
  'Кирилл Соловьёв',
  'Мария Тихонова',
  'Никита Захаров',
  'Полина Ершова',
  'Тимофей Сорокин',
];

// Детерминированный генератор: одинаковые демо-данные при каждом чистом запуске
let state = 7;
const rand = () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646;

export async function ensureDemoCollege(teacherPassword: string, studentPassword: string) {
  if (await prisma.account.findUnique({ where: { login: DIRECTOR_LOGIN } })) return;
  const school = await prisma.school.create({
    data: {
      name: 'Колледж информационных технологий',
      kind: 'COLLEGE',
      heroes: true,
      admins: {
        create: {
          name: 'Директор колледжа',
          account: { create: { login: DIRECTOR_LOGIN, role: 'ADMIN', passwordHash: await hashPassword(DIRECTOR_PASSWORD) } },
        },
      },
    },
  });
  const department = await prisma.department.create({ data: { schoolId: school.id, name: 'Отделение информационных технологий' } });
  const teacherHash = await hashPassword(teacherPassword);
  const teacher = (name: string, login: string) =>
    prisma.teacher.create({
      data: { name, school: { connect: { id: school.id } }, account: { create: { login, role: 'TEACHER', passwordHash: teacherHash } } },
    });
  const curator = await teacher('Ольга Викторовна Белова', CURATOR_LOGIN);
  const lecturer = await teacher('Игорь Сергеевич Ершов', LECTURER_LOGIN);

  // У студентов колледжа родители по умолчанию выключены: многие уже совершеннолетние
  const group = await prisma.group.create({
    data: {
      name: 'ИС-21', teacherId: curator.id, parentsEnabled: false, heroes: true,
      departmentId: department.id, course: 2, specialty: 'Информационные системы и программирование',
    },
  });
  await createDefaultReasons(prisma, group.id);
  await createDefaultRewards(prisma, group.id);

  const [algorithms, databases, english] = await Promise.all(
    ['Основы алгоритмизации', 'Базы данных', 'Английский язык'].map((name) =>
      prisma.subject.create({ data: { schoolId: school.id, name } })),
  );
  await prisma.groupSubject.createMany({
    data: [
      { groupId: group.id, subjectId: algorithms.id, teacherId: lecturer.id },
      { groupId: group.id, subjectId: databases.id, teacherId: lecturer.id },
      { groupId: group.id, subjectId: english.id, teacherId: curator.id },
    ],
  });
  // Преподаватель дисциплины ведёт пары в группе как соавтор
  await prisma.groupTeacher.create({ data: { groupId: group.id, teacherId: lecturer.id } });

  const studentHash = await hashPassword(studentPassword);
  const taken = new Set((await prisma.account.findMany({ select: { login: true } })).map((a) => a.login));
  const students = [];
  for (const name of STUDENTS) {
    const login = pickLogin(loginBase(name), taken);
    taken.add(login);
    students.push(
      await prisma.student.create({
        data: {
          name,
          group: { connect: { id: group.id } },
          account: { create: { login, passwordHash: studentHash, role: 'STUDENT' } },
          hero: { create: { parts: randomHero(rand) } },
        },
        include: { account: true },
      }),
    );
  }

  // Две недели пар: каждая со своей дисциплиной и преподавателем, посещаемость и баллы
  const reasons = await prisma.behaviorReason.findMany({ where: { groupId: group.id, kind: 'MANUAL' } });
  const plus = reasons.filter((r) => r.value > 0);
  const minus = reasons.filter((r) => r.value < 0);
  const visit = await attendanceReason(prisma, group.id);
  const today = startOfDay();
  const pairs = [
    { daysAgo: 12, lesson: 1, subject: algorithms, by: lecturer },
    { daysAgo: 12, lesson: 2, subject: english, by: curator },
    { daysAgo: 9, lesson: 1, subject: databases, by: lecturer },
    { daysAgo: 7, lesson: 2, subject: algorithms, by: lecturer },
    { daysAgo: 5, lesson: 1, subject: english, by: curator },
    { daysAgo: 2, lesson: 1, subject: databases, by: lecturer },
    { daysAgo: 1, lesson: 2, subject: algorithms, by: lecturer },
  ];
  for (const pair of pairs) {
    const day = addDays(today, -pair.daysAgo);
    const at = (min: number) => new Date(day.getTime() + ((8 + pair.lesson * 2) * 60 + min) * 60_000);
    const present = students.filter(() => rand() > 0.15);
    const session = await prisma.attendanceSession.create({
      data: {
        groupId: group.id, date: dbDate(dateKey(day)), lessonNumber: pair.lesson, peopleOnPhoto: null, subtractedTeacher: false,
        studentsTotal: students.length, createdById: pair.by.accountId, subjectId: pair.subject.id,
        records: { create: students.map((s) => ({ studentId: s.id, present: present.includes(s) })) },
      },
    });
    for (const s of present) {
      const events = [{ r: visit, min: 0 }];
      for (let i = 0; i < Math.floor(rand() * 3); i++) events.push({ r: plus[Math.floor(rand() * plus.length)], min: 10 + i * 15 });
      if (rand() < 0.12) events.push({ r: minus[Math.floor(rand() * minus.length)], min: 50 });
      await prisma.pointEvent.createMany({
        data: events.map(({ r, min }) => ({
          studentId: s.id, reasonId: r.id, reasonName: r.name, emoji: r.emoji, value: r.value, createdAt: at(min),
          awardedById: pair.by.accountId, helpBadge: r.value > 0 && r.countsForHelpBadge, awardedGroupId: group.id,
          subjectId: pair.subject.id, attendanceSessionId: r.kind === 'ATTENDANCE' ? session.id : null,
        })),
      });
    }
  }

  console.log('Seed: демо-колледж создан.');
  console.log(`  Директор: ${DIRECTOR_LOGIN} / ${DIRECTOR_PASSWORD}`);
  console.log(`  Куратор группы ИС-21: ${CURATOR_LOGIN} / ${teacherPassword}`);
  console.log(`  Преподаватель дисциплин: ${LECTURER_LOGIN} / ${teacherPassword}`);
  console.log(`  Студенты, пароль ${studentPassword}:`);
  for (const s of students) console.log(`    ${s.name.padEnd(20)} ${s.account.login}`);
}
