import { describe, expect, it } from 'vitest';
import { inQuietHours, parentNotice } from '../src/modules/messages/quiet.service.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const later = (minutes = 60) => new Date(Date.now() + minutes * 60_000).toISOString();

async function withParent(t: Teacher, i = 0) {
  const issued = (await call('POST', `/api/teacher/students/${t.students[i].id}/parents`, { cookie: t.cookie })).body;
  const cookie = await login(issued.login, issued.password);
  const student = t.students[i].id;
  return {
    ...issued,
    cookie,
    student,
    thread: `/api/teacher/students/${student}/parents/${issued.parentId}/messages`,
    own: `/api/parent/children/${student}/messages`,
  };
}

describe('отправка позже', () => {
  it('родитель не видит сообщение до срока, значка нет; преподаватель видит и может отменить', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const p = await withParent(t);
    const res = await call('POST', p.thread, { cookie: t.cookie, body: { text: 'Завтра родительское собрание', sendAt: later() } });
    expect(res.body).toMatchObject([{ scheduled: true, mine: true }]);
    expect((await call('GET', p.own, { cookie: p.cookie })).body).toEqual([]);
    expect((await call('GET', '/api/notifications', { cookie: p.cookie })).body.messages).toBe(0);
    expect((await call('GET', '/api/teacher/messages', { cookie: t.cookie })).body).toEqual([]);
    const id = res.body[0].id;
    expect((await call('DELETE', `${p.thread}/${id}`, { cookie: t.cookie })).body).toEqual([]);
  });

  it('в своё время сообщение приходит и считается новым', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const p = await withParent(t);
    const [{ id }] = (await call('POST', p.thread, { cookie: t.cookie, body: { text: 'Напоминание', sendAt: later() } })).body;
    await call('GET', p.own, { cookie: p.cookie });
    await prisma.message.update({ where: { id }, data: { createdAt: new Date() } });
    expect((await call('GET', '/api/notifications', { cookie: p.cookie })).body.messages).toBe(1);
    expect((await call('GET', p.own, { cookie: p.cookie })).body).toMatchObject([{ text: 'Напоминание', scheduled: false }]);
    expect((await call('DELETE', `${p.thread}/${id}`, { cookie: t.cookie })).status).toBe(404);
    expect((await call('GET', '/api/teacher/messages', { cookie: t.cookie })).body).toHaveLength(1);
  });

  it('время только в будущем; отменить чужое нельзя; родитель отложить не может', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const p = await withParent(t);
    expect((await call('POST', p.thread, { cookie: t.cookie, body: { text: 'x', sendAt: later(-5) } })).status).toBe(400);
    expect((await call('POST', p.thread, { cookie: t.cookie, body: { text: 'x', sendAt: later(61 * 24 * 60) } })).status).toBe(400);
    const [{ id }] = (await call('POST', p.thread, { cookie: t.cookie, body: { text: 'x', sendAt: later() } })).body;
    const other = await setupTeacher(['Петя Смирнов']);
    expect((await call('DELETE', `${p.thread}/${id}`, { cookie: other.cookie })).status).toBe(404);
    const own = await call('POST', p.own, { cookie: p.cookie, body: { text: 'Привет', sendAt: later() } });
    expect(own.body).toMatchObject([{ text: 'Привет', scheduled: false }]);
  });
});

describe('рассылка родителям группы', () => {
  it('каждый родитель получает одно сообщение в своей ветке и может ответить', async () => {
    const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов', 'Оля Котова']);
    const first = await withParent(t, 0);
    const second = await withParent(t, 1);
    const path = `/api/teacher/groups/${t.group.id}/messages`;
    const res = await call('POST', path, { cookie: t.cookie, body: { text: ' Завтра субботник ' } });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ sent: 2 });
    expect((await call('GET', first.own, { cookie: first.cookie })).body).toMatchObject([{ text: 'Завтра субботник', fromParent: false }]);
    expect((await call('GET', second.own, { cookie: second.cookie })).body).toHaveLength(1);
    await call('POST', second.own, { cookie: second.cookie, body: { text: 'Придём' } });
    expect((await call('GET', second.thread, { cookie: t.cookie })).body.messages).toHaveLength(2);
    expect((await call('GET', first.thread, { cookie: t.cookie })).body.messages).toHaveLength(1);
  });

  it('родитель двоих детей группы получает сообщение один раз', async () => {
    const t = await setupTeacher(['Ваня Иванов', 'Маша Иванова']);
    const issued = (await call('POST', `/api/teacher/students/${t.students[1].id}/parents`, { cookie: t.cookie })).body;
    await call('POST', `/api/teacher/students/${t.students[0].id}/parents/link`, { cookie: t.cookie, body: { login: issued.login } });
    const res = await call('POST', `/api/teacher/groups/${t.group.id}/messages`, { cookie: t.cookie, body: { text: 'Новость' } });
    expect(res.body).toEqual({ sent: 1 });
  });

  it('отложенная рассылка приходит в срок; без родителей, в архиве и у чужого — отказ', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const path = `/api/teacher/groups/${t.group.id}/messages`;
    expect((await call('POST', path, { cookie: t.cookie, body: { text: 'x' } })).status).toBe(400);
    const p = await withParent(t);
    expect((await call('POST', path, { cookie: t.cookie, body: { text: 'Позже', sendAt: later() } })).status).toBe(201);
    expect((await call('GET', p.own, { cookie: p.cookie })).body).toEqual([]);
    const other = await setupTeacher(['Петя Смирнов']);
    expect((await call('POST', path, { cookie: other.cookie, body: { text: 'x' } })).status).toBe(404);
    await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
    expect((await call('POST', path, { cookie: t.cookie, body: { text: 'x' } })).status).toBe(409);
  });
});

describe('тихие часы', () => {
  it('промежуток через полночь и внутри дня считается верно', () => {
    expect(inQuietHours(22 * 60, 7 * 60, 23 * 60)).toBe(true);
    expect(inQuietHours(22 * 60, 7 * 60, 6 * 60)).toBe(true);
    expect(inQuietHours(22 * 60, 7 * 60, 7 * 60)).toBe(false);
    expect(inQuietHours(13 * 60, 14 * 60, 13 * 60 + 30)).toBe(true);
    expect(inQuietHours(13 * 60, 14 * 60, 14 * 60)).toBe(false);
  });

  it('настройка сохраняется, плохие значения отклоняются', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const url = '/api/teacher/me/quiet-hours';
    expect((await call('GET', url, { cookie: t.cookie })).body).toEqual({ hours: null });
    const hours = { from: '22:00', to: '07:30' };
    expect((await call('PUT', url, { cookie: t.cookie, body: { hours } })).body).toEqual({ hours });
    expect((await call('GET', url, { cookie: t.cookie })).body).toEqual({ hours });
    for (const bad of [{ from: '25:00', to: '07:00' }, { from: '07:00', to: '07:00' }, { from: '7:00', to: '08:00' }]) {
      expect((await call('PUT', url, { cookie: t.cookie, body: { hours: bad } })).status).toBe(400);
    }
    expect((await call('PUT', url, { cookie: t.cookie, body: { hours: null } })).body).toEqual({ hours: null });
  });

  const around = (now: Date) => ({ from: (now.getHours() * 60 + now.getMinutes() + 1439) % 1440, to: (now.getHours() * 60 + now.getMinutes() + 120) % 1440 });

  it('значка сообщений нет, сами сообщения на месте', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const p = await withParent(t);
    await call('POST', p.own, { cookie: p.cookie, body: { text: 'Вечером' } });
    expect((await call('GET', '/api/notifications', { cookie: t.cookie })).body.messages).toBe(1);
    const { from, to } = around(new Date());
    await prisma.teacher.update({ where: { id: t.teacher.id }, data: { quietFrom: from, quietTo: to } });
    expect((await call('GET', '/api/notifications', { cookie: t.cookie })).body.messages).toBe(0);
    expect((await call('GET', '/api/teacher/messages', { cookie: t.cookie })).body[0].unread).toBe(1);
  });

  it('родитель видит подсказку, только когда отдыхают все преподаватели группы', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const co = await setupTeacher(['Петя Смирнов']);
    const p = await withParent(t);
    const notice = () => call('GET', `/api/parent/children/${p.student}/quiet-hours`, { cookie: p.cookie });
    expect((await notice()).body).toEqual({ quietUntil: null });
    const now = new Date(2026, 10, 2, 23, 0);
    await prisma.teacher.update({ where: { id: t.teacher.id }, data: { quietFrom: 22 * 60, quietTo: 7 * 60 } });
    expect(await parentNotice(p.student, now)).toEqual({ quietUntil: '07:00' });
    await prisma.groupTeacher.create({ data: { groupId: t.group.id, teacherId: co.teacher.id } });
    expect(await parentNotice(p.student, now)).toEqual({ quietUntil: null });
    await prisma.teacher.update({ where: { id: co.teacher.id }, data: { quietFrom: 21 * 60, quietTo: 6 * 60 } });
    expect(await parentNotice(p.student, now)).toEqual({ quietUntil: '06:00' });
    expect(await parentNotice(p.student, new Date(2026, 10, 2, 12, 0))).toEqual({ quietUntil: null });
  });

  it('чужой ребёнок — 404', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const other = await setupTeacher(['Петя Смирнов']);
    const p = await withParent(other);
    expect((await call('GET', `/api/parent/children/${t.students[0].id}/quiet-hours`, { cookie: p.cookie })).status).toBe(404);
  });
});
