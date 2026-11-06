import { expect, it } from 'vitest';
import { reportPdf, studentReport } from '../src/modules/reports/index.js';
import { dateKey } from '../src/platform/dates.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';
import { picture } from './images.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const JPEG = await picture(40, 30, 'image/jpeg');

function form(fields: Record<string, string>, files: [string, Uint8Array][] = []) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  for (const [name, bytes] of files) data.append('file', new File([bytes as BlobPart], name));
  return data;
}

const give = async (t: Teacher, title: string, points = '0') =>
  (await call('POST', `/api/teacher/groups/${t.group.id}/assignments`, { cookie: t.cookie, raw: form({ title, points }) })).body
    .find((a: { title: string }) => a.title === title).id as string;
const answerOf = async (t: Teacher, id: string) =>
  (await call('GET', `/api/teacher/groups/${t.group.id}/assignments/${id}`, { cookie: t.cookie })).body.answers[0].work.id as string;
const decide = (t: Teacher, id: string, workId: string, status: 'APPROVED' | 'RETURNED', comment = '') =>
  call('PUT', `/api/teacher/groups/${t.group.id}/assignments/${id}/answers/${workId}`, { cookie: t.cookie, body: { status, comment } });

it('родитель видит задания ребёнка, решения и только принятые ответы; ничего не отмечает прочитанным', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Чужой Ученик']);
  const masha = await t.studentCookie(0);
  const issued = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  const parent = await login(issued.login, issued.password);
  const path = `/api/parent/children/${t.students[0].id}/assignments`;

  const poem = await give(t, 'Выучить стих', '2');
  const drawing = await give(t, 'Нарисовать осень');
  await give(t, 'Прочитать рассказ');
  await call('POST', `/api/student/assignments/${poem}/answers`, { cookie: masha, raw: form({ text: 'Выучила' }, [['видео.jpg', JPEG]]) });
  await call('POST', `/api/student/assignments/${drawing}/answers`, { cookie: masha, raw: form({ text: 'Черновик' }) });
  await decide(t, poem, await answerOf(t, poem), 'APPROVED', 'Молодец!');
  await decide(t, drawing, await answerOf(t, drawing), 'RETURNED', 'Добавь цвета');
  const unseen = (await call('GET', '/api/notifications', { cookie: masha })).body.assignments;
  expect(unseen).toBe(2);

  const list = (await call('GET', path, { cookie: parent })).body;
  expect(list.map((a: { title: string; status: string; comment: string }) => [a.title, a.status, a.comment])).toEqual([
    ['Прочитать рассказ', 'NONE', ''],
    ['Нарисовать осень', 'RETURNED', 'Добавь цвета'],
    ['Выучить стих', 'APPROVED', 'Молодец!'],
  ]);
  expect(list[1].accepted).toBeNull();
  expect(list[2].accepted).toMatchObject({ text: 'Выучила', files: [{ name: 'видео.jpg' }] });
  expect((await call('GET', `/api/files/${list[2].accepted.files[0].id}`, { cookie: parent })).status).toBe(200);
  expect((await call('GET', '/api/notifications', { cookie: masha })).body.assignments).toBe(unseen);

  expect((await call('GET', `/api/parent/children/${other.students[0].id}/assignments`, { cookie: parent })).status).toBe(404);
  expect((await call('GET', path, { cookie: masha })).status).toBe(403);
});

it('PDF-отчёт: задания за период с состоянием и баллами и опубликованные работы', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const masha = await t.studentCookie(0);
  const poem = await give(t, 'Выучить стих', '2');
  await give(t, 'Прочитать рассказ');
  await call('POST', `/api/student/assignments/${poem}/answers`, { cookie: masha, raw: form({ text: 'Выучила' }) });
  await decide(t, poem, await answerOf(t, poem), 'APPROVED');
  const work = await call('POST', '/api/student/works', { cookie: masha, raw: form({ title: 'Рисунок кота', text: 'Кот' }) });
  await call('PUT', `/api/teacher/groups/${t.group.id}/works/${work.body[0].id}`, { cookie: t.cookie, body: { status: 'APPROVED' } });
  await call('POST', '/api/student/works', { cookie: masha, raw: form({ title: 'На проверке', text: 'x' }) });

  const today = dateKey();
  const report = await studentReport(t.students[0].id, t.teacher.id, { from: today, to: today });
  expect(report.assignments).toEqual([
    { title: 'Выучить стих', dueOn: null, status: 'APPROVED', points: 2 },
    { title: 'Прочитать рассказ', dueOn: null, status: 'NONE', points: 0 },
  ]);
  expect(report.works).toEqual([{ title: 'Рисунок кота', date: today }]);
  expect((await reportPdf(report)).subarray(0, 5).toString()).toBe('%PDF-');

  // Задание из другого периода в отчёт не попадает
  await prisma.assignment.updateMany({ where: { title: 'Прочитать рассказ' }, data: { createdAt: new Date('2020-01-01') } });
  expect((await studentReport(t.students[0].id, t.teacher.id, { from: today, to: today })).assignments).toHaveLength(1);
});
