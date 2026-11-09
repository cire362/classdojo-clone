import { expect, it } from 'vitest';
import { addDays, dateKey } from '../src/platform/dates.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';
import { picture } from './images.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const PDF = Buffer.from('%PDF-1.7 задание');
const JPEG = await picture(40, 30, 'image/jpeg');

function form(fields: Record<string, string | string[]>, files: [string, Uint8Array][] = []) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const v of [value].flat()) data.append(key, v);
  for (const [name, bytes] of files) data.append('file', new File([bytes as BlobPart], name));
  return data;
}

const base = (t: Teacher) => `/api/teacher/groups/${t.group.id}/assignments`;
const create = (t: Teacher, fields: Record<string, string | string[]>, files: [string, Uint8Array][] = [], cookie = t.cookie) =>
  call('POST', base(t), { cookie, raw: form(fields, files) });
const answer = (cookie: string, id: string, text: string, files: [string, Uint8Array][] = []) =>
  call('POST', `/api/student/assignments/${id}/answers`, { cookie, raw: form({ text }, files) });
const decide = (t: Teacher, id: string, workId: string, status: 'APPROVED' | 'RETURNED', comment = '') =>
  call('PUT', `${base(t)}/${id}/answers/${workId}`, { cookie: t.cookie, body: { status, comment } });
const points = (studentId: string) => prisma.pointEvent.aggregate({ where: { studentId }, _sum: { value: true } }).then((r) => r._sum.value ?? 0);

it('задание всей группе: ученик сдаёт ответ, принятый ответ приносит баллы один раз, возврат их снимает', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
  const masha = await t.studentCookie(0);
  const yesterday = dateKey(addDays(new Date(), -1));
  const res = await create(t, { title: 'Решить задачи 1–5', description: 'Учебник, с. 42', points: '3', dueOn: yesterday }, [['задачи.pdf', PDF]]);
  expect(res.status).toBe(201);
  expect(res.body[0]).toMatchObject({ title: 'Решить задачи 1–5', points: 3, dueOn: yesterday, assigned: 2, pending: 0, files: [{ name: 'задачи.pdf' }] });
  const { id, files } = res.body[0];

  expect((await call('GET', '/api/notifications', { cookie: masha })).body.assignments).toBe(1);
  const [mine] = (await call('GET', '/api/student/assignments', { cookie: masha })).body;
  expect(mine).toMatchObject({ id, status: 'NONE', isNew: true, overdue: true, author: 'Тестовый учитель', works: [] });
  expect((await call('GET', '/api/notifications', { cookie: masha })).body.assignments).toBe(0);
  expect((await call('GET', `/api/files/${files[0].id}`, { cookie: masha })).status).toBe(200);

  const sent = await answer(masha, id, 'Ответы: 12, 7, 3', [['решение.jpg', JPEG]]);
  expect(sent.status).toBe(201);
  expect(sent.body[0]).toMatchObject({ status: 'PENDING', overdue: false, works: [{ title: 'Решить задачи 1–5', text: 'Ответы: 12, 7, 3' }] });
  expect((await answer(masha, id, 'Ещё раз')).status).toBe(409);
  expect((await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie })).body).toMatchObject({ pendingAnswers: 1, pendingWorks: 0 });
  expect((await call('GET', '/api/student/works', { cookie: masha })).body).toEqual([]);

  const detail = (await call('GET', `${base(t)}/${id}`, { cookie: t.cookie })).body;
  expect(detail.answers.map((a: { student: { name: string }; status: string; late: boolean }) => [a.student.name, a.status, a.late])).toEqual([
    ['Маша Иванова', 'PENDING', true],
    ['Петя Смирнов', 'NONE', false],
  ]);
  const workId = detail.answers[0].work.id;

  const before = await points(t.students[0].id);
  expect((await decide(t, id, workId, 'APPROVED', 'Верно!')).body).toMatchObject({ pending: 0, accepted: 1 });
  await decide(t, id, workId, 'APPROVED');
  expect(await points(t.students[0].id)).toBe(before + 3);
  const event = await prisma.pointEvent.findFirst({ where: { studentId: t.students[0].id, reasonName: 'Задание: Решить задачи 1–5' } });
  expect(event).toMatchObject({ value: 3, emoji: 'clipboard', awardedGroupId: t.group.id });

  await decide(t, id, workId, 'RETURNED', 'Проверь пятую');
  expect(await points(t.students[0].id)).toBe(before);
  expect((await call('GET', '/api/notifications', { cookie: masha })).body.assignments).toBe(1);
  const returned = (await call('GET', '/api/student/assignments', { cookie: masha })).body[0];
  expect(returned).toMatchObject({ status: 'RETURNED', overdue: true, works: [{ comment: 'Проверь пятую', status: 'RETURNED' }] });
  expect((await answer(masha, id, 'Исправила пятую')).status).toBe(201);
  expect((await call('GET', '/api/student/assignments', { cookie: masha })).body[0].works).toHaveLength(2);
});

it('задание команде или выбранным ученикам: остальные его не видят и не сдают', async () => {
  const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов', 'Оля Котова']);
  const team = await prisma.team.create({ data: { groupId: t.group.id, name: 'Синие', color: 'blue' } });
  await prisma.student.updateMany({ where: { id: { in: [t.students[0].id, t.students[1].id] } }, data: { teamId: team.id } });
  const issued = (await call('POST', `/api/teacher/students/${t.students[2].id}/parents`, { cookie: t.cookie })).body;
  const olyaParent = await login(issued.login, issued.password);

  const forTeam = (await create(t, { title: 'Проект команды', target: 'team', teamId: team.id }, [['план.pdf', PDF]])).body[0];
  expect(forTeam.assigned).toBe(2);
  const olya = await t.studentCookie(2);
  expect((await call('GET', '/api/student/assignments', { cookie: olya })).body).toEqual([]);
  expect((await answer(olya, forTeam.id, 'Хочу тоже')).status).toBe(404);
  expect((await call('GET', `/api/files/${forTeam.files[0].id}`, { cookie: olya })).status).toBe(404);
  expect((await call('GET', `/api/files/${forTeam.files[0].id}`, { cookie: olyaParent })).status).toBe(404);

  const forOlya = (await create(t, { title: 'Догнать тему', target: 'students', studentId: [t.students[2].id] }, [['тема.pdf', PDF]])).body[0];
  expect(forOlya.assigned).toBe(1);
  expect((await call('GET', '/api/student/assignments', { cookie: olya })).body.map((a: { title: string }) => a.title)).toEqual(['Догнать тему']);
  expect((await call('GET', `/api/files/${forOlya.files[0].id}`, { cookie: olyaParent })).status).toBe(200);
});

it('проверки: поля, чужие ученики и команды, архив, чужой преподаватель, удаление', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Чужой Ученик']);
  const foreignTeam = await prisma.team.create({ data: { groupId: other.group.id, name: 'Чужие', color: 'red' } });
  expect((await create(t, { description: 'Без названия' })).status).toBe(400);
  expect((await create(t, { title: 'Кому?', target: 'students' })).status).toBe(400);
  expect((await create(t, { title: 'Чужому', target: 'students', studentId: [other.students[0].id] })).status).toBe(404);
  expect((await create(t, { title: 'Чужой команде', target: 'team', teamId: foreignTeam.id })).status).toBe(404);
  expect((await create(t, { title: 'Срок', dueOn: '07.11.2026' })).status).toBe(400);
  expect((await create(t, { title: 'Много баллов', points: '11' })).status).toBe(400);
  expect((await create(t, { title: 'Не своей группе' }, [], other.cookie)).status).toBe(404);

  const masha = await t.studentCookie(0);
  const [task] = (await create(t, { title: 'Стих', points: '2' }, [['стих.pdf', PDF]])).body;
  await answer(masha, task.id, 'Выучила');
  const workId = (await call('GET', `${base(t)}/${task.id}`, { cookie: t.cookie })).body.answers[0].work.id;
  expect((await call('PUT', `/api/teacher/groups/${other.group.id}/assignments/${task.id}/answers/${workId}`, {
    cookie: other.cookie, body: { status: 'APPROVED' },
  })).status).toBe(404);
  await decide(t, task.id, workId, 'APPROVED');
  const awarded = await points(t.students[0].id);

  await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
  expect((await create(t, { title: 'В архиве' })).status).toBe(409);
  expect((await decide(t, task.id, workId, 'RETURNED')).status).toBe(409);
  expect((await call('GET', `${base(t)}/${task.id}`, { cookie: t.cookie })).status).toBe(200);
  await prisma.group.update({ where: { id: t.group.id }, data: { archivedAt: null } });

  // Удаление задания уносит ответы и файлы, а выданные баллы остаются
  expect((await call('DELETE', `${base(t)}/${task.id}`, { cookie: t.cookie })).body).toEqual([]);
  expect(await prisma.studentWork.count({ where: { studentId: t.students[0].id } })).toBe(0);
  expect(await prisma.storedFile.count({ where: { groupId: t.group.id } })).toBe(0);
  expect(await points(t.students[0].id)).toBe(awarded);
});
