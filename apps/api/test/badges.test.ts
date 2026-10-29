import { expect, it } from 'vitest';
import { type BadgeId, type StudentBadge } from '@heroes/shared';
import { prisma } from '../src/db.js';
import { dateKey, addDays, dbDate } from '../src/lib/dates.js';
import { call, login, setupTeacher } from './helpers.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
async function badge(t: Teacher, id: BadgeId, i = 0) {
  const profile = await call('GET', `/api/teacher/students/${t.students[i].id}/profile`, { cookie: t.cookie });
  expect(profile.status).toBe(200);
  return profile.body.badges.find((b: StudentBadge) => b.id === id) as StudentBadge;
}
const award = (t: Teacher, reasonId: string, indices = [0]) => call('POST', `/api/teacher/groups/${t.group.id}/points`, {
  cookie: t.cookie, body: { reasonId, studentIds: indices.map((i) => t.students[i].id) },
});
// История уровня создаётся напрямую, а границу уровня/исправления проверяем через публичный API.
const points = (t: Teacher, i: number, value: number, createdAt = new Date(), awardedGroupId: string | null = t.group.id) =>
  prisma.pointEvent.create({ data: { studentId: t.students[i].id, reasonName: 'Работа', emoji: '⭐', value, createdAt, awardedGroupId } });

it('помощь: считаются случаи, а не сумма; снимок переживает переименование и архивирование причины', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const help = await prisma.behaviorReason.findFirstOrThrow({ where: { groupId: t.group.id, countsForHelpBadge: true } });
  expect(help.name).toBe('Помог другу');
  await prisma.pointEvent.createMany({ data: Array.from({ length: 19 }, () => ({ studentId: t.students[0].id, reasonId: help.id, reasonName: help.name, emoji: help.emoji, value: 2, helpBadge: true, awardedGroupId: t.group.id })) });
  await award(t, t.plus2Reason.id);
  await award(t, t.minusReason.id);
  expect(await badge(t, 'help.20')).toMatchObject({ progress: 19, earnedOn: null });
  const final = await award(t, help.id);
  expect(final.status).toBe(201);
  expect(await badge(t, 'help.20')).toMatchObject({ progress: 20, earnedOn: dateKey() });
  await call('PATCH', `/api/teacher/reasons/${help.id}`, { cookie: t.cookie, body: { name: 'Другое название', emoji: '⭐', value: 2, countsForHelpBadge: false } });
  await call('DELETE', `/api/teacher/reasons/${help.id}`, { cookie: t.cookie });
  expect((await badge(t, 'help.20')).earnedOn).toBe(dateKey());
  await call('DELETE', `/api/teacher/points/${final.body.eventIds[0]}`, { cookie: t.cookie });
  expect(await badge(t, 'help.20')).toMatchObject({ progress: 19, earnedOn: null });
});

it('помощь можно включить для своей причины; отрицательные начисления никогда не считаются помощью', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const created = await call('POST', `/api/teacher/groups/${t.group.id}/reasons`, { cookie: t.cookie, body: { name: 'Объяснил задачу', emoji: '🤝', value: 3, countsForHelpBadge: true } });
  expect(created.body.countsForHelpBadge).toBe(true);
  await award(t, created.body.id);
  // Старый клиент при редактировании может не прислать флаг — он сохраняется.
  await call('PATCH', `/api/teacher/reasons/${created.body.id}`, { cookie: t.cookie, body: { name: 'Объяснил тему', emoji: '🤝', value: -1 } });
  await award(t, created.body.id);
  expect(await badge(t, 'help.20')).toMatchObject({ progress: 1, earnedOn: null });
  expect((await call('GET', `/api/teacher/groups/${t.group.id}/reasons`, { cookie: t.cookie })).body.find((r: { id: string }) => r.id === created.body.id).countsForHelpBadge).toBe(true);
});

it('10 отмеченных уроков: несколько в день, поздний пропуск сохраняет значок, исправление серии убирает', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const dates: { date: string; lesson: number }[] = [];
  for (let i = 0; i < 11; i++) {
    const date = dateKey(addDays(new Date(), -6 + Math.floor(i / 2)));
    const lesson = i % 2 + 1;
    dates.push({ date, lesson });
    const saved = await call('POST', `/api/teacher/groups/${t.group.id}/attendance`, { cookie: t.cookie, body: { date, lesson, presentStudentIds: i < 10 ? [t.students[0].id] : [], peopleOnPhoto: null, subtractedTeacher: false } });
    expect(saved.status).toBe(201);
    if (i === 8) expect(await badge(t, 'attendance.streak10')).toMatchObject({ progress: 9, earnedOn: null });
  }
  expect(await badge(t, 'attendance.streak10')).toMatchObject({ progress: 10, earnedOn: dates[9].date });
  await call('POST', `/api/teacher/groups/${t.group.id}/attendance`, { cookie: t.cookie, body: { ...dates[4], presentStudentIds: [], peopleOnPhoto: null, subtractedTeacher: false } });
  expect(await badge(t, 'attendance.streak10')).toMatchObject({ progress: 5, earnedOn: null });
});

it('серия — подряд присутствующие уроки, пропуск обрывает; полная история учитывается за пределами последних 300 записей', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const studentId = t.students[0].id;
  for (let i = 0; i < 20; i++) {
    await prisma.attendanceSession.create({ data: { groupId: t.group.id, date: dbDate(dateKey(addDays(new Date(), i - 30))), lessonNumber: 1, studentsTotal: 1, createdById: t.teacher.accountId, records: { create: { studentId, present: i !== 5 } } } });
  }
  await prisma.pointEvent.createMany({ data: Array.from({ length: 321 }, (_, i) => ({ studentId, reasonName: 'Помощь', emoji: '⭐', value: 1, helpBadge: i < 20, createdAt: addDays(new Date(), i < 20 ? -30 : -1) })) });
  const profile = (await call('GET', `/api/student/profile`, { cookie: await t.studentCookie(0) })).body;
  expect(profile.history).toHaveLength(300);
  expect(profile.badges.find((b: StudentBadge) => b.id === 'help.20')).toMatchObject({ progress: 20, earnedOn: dateKey(addDays(new Date(), -30)) });
  expect(profile.badges.find((b: StudentBadge) => b.id === 'attendance.streak10')).toMatchObject({ earnedOn: dateKey(addDays(new Date(), -15)) });
});

it('первый 5-й уровень: массовое начисление даёт общее первенство, позднему ученику не даёт; исправление пересчитывает', async () => {
  const t = await setupTeacher();
  for (let i = 0; i < 3; i++) await points(t, i, 69);
  const tied = await award(t, t.plusReason.id, [0, 1]);
  expect(tied.status).toBe(201);
  const batch = await prisma.pointEvent.findMany({ where: { id: { in: tied.body.eventIds } }, select: { createdAt: true } });
  expect(new Set(batch.map((e) => e.createdAt.getTime())).size).toBe(1);
  for (const i of [0, 1]) expect(await badge(t, 'level.first5', i)).toMatchObject({ progress: 1, earnedOn: dateKey(), groupName: t.group.name });
  const later = await award(t, t.plusReason.id, [2]);
  expect((await badge(t, 'level.first5', 2)).earnedOn).toBeNull();
  // Списание и трата не отнимают уровень или первенство.
  await award(t, t.minusReason.id);
  expect((await badge(t, 'level.first5')).progress).toBe(1);
  await call('POST', '/api/teacher/points/undo', { cookie: t.cookie, body: { eventIds: tied.body.eventIds } });
  expect((await badge(t, 'level.first5')).earnedOn).toBeNull();
  expect((await badge(t, 'level.first5', 2)).progress).toBe(1);
  expect(later.body.eventIds).toHaveLength(1);
});

it('перевод сохраняет значок исходной группы и не переносит первенство в другую', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
  await points(t, 0, 70);
  const destination = (await call('POST', '/api/teacher/groups', { cookie: t.cookie, body: { name: 'Новая группа' } })).body;
  expect((await call('POST', `/api/teacher/students/${t.students[0].id}/move`, { cookie: t.cookie, body: { groupId: destination.id } })).status).toBe(200);
  expect(await badge(t, 'level.first5')).toMatchObject({ progress: 1, groupName: t.group.name });
  await call('POST', `/api/teacher/students/${t.students[1].id}/move`, { cookie: t.cookie, body: { groupId: destination.id } });
  await points(t, 1, 70, new Date(), destination.id);
  expect(await badge(t, 'level.first5', 1)).toMatchObject({ progress: 1, groupName: 'Новая группа' });
});

it('по старой истории и уровню до запуска значков первенство не выдумывается', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов', 'Оля Котова']);
  await points(t, 0, 70, addDays(new Date(), -1), null);
  await points(t, 1, 70, addDays(new Date(), -1));
  await award(t, t.plusReason.id, [0, 1]);
  expect((await badge(t, 'level.first5', 0)).earnedOn).toBeNull();
  expect((await badge(t, 'level.first5', 1)).earnedOn).toBeNull();
  await points(t, 2, 70);
  expect((await badge(t, 'level.first5', 2)).progress).toBe(1);
});

it('повторная отметка сегодняшнего урока не передвигает его во времени и не меняет первенство', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
  await points(t, 0, 69);
  await points(t, 1, 69);
  const save = () => call('POST', `/api/teacher/groups/${t.group.id}/attendance`, { cookie: t.cookie, body: { lesson: 1, presentStudentIds: [t.students[0].id], peopleOnPhoto: null, subtractedTeacher: false } });
  await save();
  await award(t, t.plusReason.id, [1]);
  await save();
  expect((await badge(t, 'level.first5')).progress).toBe(1);
  expect((await badge(t, 'level.first5', 1)).earnedOn).toBeNull();
});

it('ученик, родитель и преподаватель видят одинаковые значки, чужие профили закрыты, ручное портфолио отдельно', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Чужой Ученик']);
  await points(t, 0, 70);
  const issued = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  const student = await call('GET', '/api/student/profile', { cookie: await t.studentCookie(0) });
  const parent = await call('GET', `/api/parent/children/${t.students[0].id}/profile`, { cookie: await login(issued.login, issued.password) });
  const teacher = await call('GET', `/api/teacher/students/${t.students[0].id}/profile`, { cookie: t.cookie });
  expect(student.body.badges).toEqual(parent.body.badges);
  expect(student.body.badges).toEqual(teacher.body.badges);
  expect(student.body.portfolio).toEqual([]);
  expect((await call('GET', `/api/teacher/students/${t.students[0].id}/profile`, { cookie: other.cookie })).status).toBe(404);
});
