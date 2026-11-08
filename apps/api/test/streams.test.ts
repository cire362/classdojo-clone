import { expect, it } from 'vitest';
import { dateKey } from '../src/platform/dates.js';
import { prisma } from '../src/platform/db.js';
import { call, setupTeacher } from './helpers.js';

type Named = { id: string; name: string };

it('поток: две группы на одной лекции — баллы и посещаемость раскладываются по группам', async () => {
  const school = await prisma.school.create({ data: { name: 'Политех', kind: 'UNIVERSITY' } });
  const t = await setupTeacher(['Маша Иванова'], school.id);
  const other = await setupTeacher(['Чужой Студент'], school.id);
  const second = (await call('POST', '/api/teacher/groups', { cookie: t.cookie, body: { name: 'ПИ-22' } })).body;
  const added = await call('POST', `/api/teacher/groups/${second.id}/students`, { cookie: t.cookie, body: { names: ['Петя Смирнов'] } });
  const petya: string = added.body.credentials[0].id;
  const masha = t.students[0].id;
  // Дисциплина ведётся только в первой группе: во второй баллы потока идут без неё
  const subject = (await call('POST', '/api/teacher/subjects', { cookie: t.cookie, body: { name: 'Матанализ' } })).body[0].id;
  const link = { subjectId: subject, teacherId: t.teacher.id };
  await call('POST', `/api/teacher/groups/${t.group.id}/subjects`, { cookie: t.cookie, body: link });

  const create = (groupIds: string[]) =>
    call('POST', '/api/teacher/streams', { cookie: t.cookie, body: { name: 'Лекция', groupIds, subjectId: subject } });
  expect((await create([t.group.id])).status).toBe(400);
  expect((await create([t.group.id, other.group.id])).status).toBe(404);
  const created = await create([t.group.id, second.id]);
  expect(created.status).toBe(201);
  const stream = created.body[0];
  expect(stream.subject.name).toBe('Матанализ');
  expect(stream.groups.map((g: Named) => g.name)).toEqual(['ПИ-22', 'Тестовая группа']);
  expect((await call('GET', `/api/teacher/streams/${stream.id}`, { cookie: other.cookie })).status).toBe(404);

  const board = (await call('GET', `/api/teacher/streams/${stream.id}`, { cookie: t.cookie })).body;
  expect(board.groups.map((g: { students: Named[] }) => g.students.map((s) => s.name))).toEqual([['Петя Смирнов'], ['Маша Иванова']]);

  // Своя причина одной группы: в другой появляется такая же
  const custom = await call('POST', `/api/teacher/groups/${second.id}/reasons`, {
    cookie: t.cookie, body: { name: 'Решил у доски', emoji: '🧮', value: 3 },
  });
  const award = await call('POST', `/api/teacher/streams/${stream.id}/points`, {
    cookie: t.cookie, body: { studentIds: [masha, petya], reasonId: custom.body.id },
  });
  expect(award.status).toBe(201);
  expect(award.body.value).toBe(3);
  expect(award.body.summaries[masha].totalEarned).toBe(3);
  const copies = await prisma.behaviorReason.findMany({ where: { name: 'Решил у доски' }, select: { groupId: true } });
  expect(copies.map((r) => r.groupId).sort()).toEqual([t.group.id, second.id].sort());
  const events = await prisma.pointEvent.findMany({ where: { studentId: { in: [masha, petya] } } });
  expect(events.find((e) => e.studentId === masha)).toMatchObject({ subjectId: subject, awardedGroupId: t.group.id });
  expect(events.find((e) => e.studentId === petya)).toMatchObject({ subjectId: null, awardedGroupId: second.id });
  const foreign = await call('POST', `/api/teacher/streams/${stream.id}/points`, {
    cookie: t.cookie, body: { studentIds: [other.students[0].id], reasonId: custom.body.id },
  });
  expect(foreign.status).toBe(404);

  const today = dateKey();
  const base = `/api/teacher/streams/${stream.id}/attendance`;
  const saved = await call('POST', base, { cookie: t.cookie, body: { date: today, lesson: 2, presentStudentIds: [petya] } });
  expect(saved.body).toEqual({ presentCount: 1, studentsTotal: 2 });
  const read = await call('GET', `${base}?date=${today}&lesson=2`, { cookie: t.cookie });
  expect(read.body).toMatchObject({ marked: 2, presentStudentIds: [petya] });
  const day = (await call('GET', `/api/teacher/groups/${t.group.id}/attendance?date=${today}&lesson=2`, { cookie: t.cookie })).body;
  expect(day.session).toMatchObject({ presentStudentIds: [], markedStudentIds: [masha] });

  // Группа ушла в архив: поток продолжает работать с оставшейся
  await prisma.group.update({ where: { id: second.id }, data: { archivedAt: new Date() } });
  const rest = (await call('GET', `/api/teacher/streams/${stream.id}`, { cookie: t.cookie })).body;
  expect(rest.groups.map((g: Named) => g.id)).toEqual([t.group.id]);
  expect((await call('DELETE', `/api/teacher/streams/${stream.id}`, { cookie: t.cookie })).body).toEqual([]);
});

it('поток меняется только хозяином; дисциплина — только из своего учреждения', async () => {
  const school = await prisma.school.create({ data: { name: 'Колледж', kind: 'COLLEGE' } });
  const t = await setupTeacher(['Маша Иванова'], school.id);
  const other = await setupTeacher(['Петя Смирнов']);
  const second = (await call('POST', '/api/teacher/groups', { cookie: t.cookie, body: { name: 'Б-11' } })).body;
  const otherSchool = await prisma.school.create({ data: { name: 'Другой' } });
  const foreignSubject = await prisma.subject.create({ data: { schoolId: otherSchool.id, name: 'Химия' } });
  const body = { name: 'Поток 1', groupIds: [t.group.id, second.id] };
  const withForeign = { ...body, subjectId: foreignSubject.id };
  expect((await call('POST', '/api/teacher/streams', { cookie: t.cookie, body: withForeign })).status).toBe(404);
  const [stream] = (await call('POST', '/api/teacher/streams', { cookie: t.cookie, body })).body;
  expect(stream.subject).toBeNull();
  expect((await call('PATCH', `/api/teacher/streams/${stream.id}`, { cookie: other.cookie, body })).status).toBe(404);
  expect((await call('DELETE', `/api/teacher/streams/${stream.id}`, { cookie: other.cookie })).status).toBe(404);
  const renamed = await call('PATCH', `/api/teacher/streams/${stream.id}`, { cookie: t.cookie, body: { ...body, name: 'Поток 2' } });
  expect(renamed.body[0].name).toBe('Поток 2');
});
