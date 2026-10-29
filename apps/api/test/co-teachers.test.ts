import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { call, setupTeacher } from './helpers.js';

const loginOf = async (teacherId: string) =>
  (await prisma.teacher.findUniqueOrThrow({ where: { id: teacherId }, include: { account: true } })).account.login;

describe('несколько преподавателей в группе', () => {
  it('соавтор ведёт урок, но не управляет самой группой', async () => {
    const owner = await setupTeacher(['Маша Иванова']);
    const colleague = await setupTeacher(['Свой Ученик']);
    const g = `/api/teacher/groups/${owner.group.id}`;

    // До приглашения группа коллеге не видна
    expect((await call('GET', g, { cookie: colleague.cookie })).status).toBe(404);
    const added = await call('POST', `${g}/teachers`, { cookie: owner.cookie, body: { login: await loginOf(colleague.teacher.id) } });
    expect(added.status).toBe(200);
    expect(added.body.coTeachers.map((t: { id: string }) => t.id)).toEqual([colleague.teacher.id]);

    const list = await call('GET', '/api/teacher/groups', { cookie: colleague.cookie });
    const shared = list.body.find((x: { id: string }) => x.id === owner.group.id);
    expect(shared).toMatchObject({ isOwner: false, colleagues: ['Тестовый учитель'] });
    expect((await call('GET', g, { cookie: colleague.cookie })).body.group.isOwner).toBe(false);

    // Урок, ученики и родители — можно
    const award = await call('POST', `${g}/points`, {
      cookie: colleague.cookie,
      body: { studentIds: [owner.students[0].id], reasonId: owner.plusReason.id },
    });
    expect(award.status).toBe(201);
    expect((await call('POST', `${g}/students`, { cookie: colleague.cookie, body: { names: ['Новый Ученик'] } })).status).toBe(201);
    expect((await call('PATCH', g, { cookie: colleague.cookie, body: { subtractTeacher: false } })).status).toBe(200);

    // Управление группой — только владельцу
    expect((await call('PATCH', g, { cookie: colleague.cookie, body: { name: 'Чужое название' } })).status).toBe(403);
    expect((await call('POST', `${g}/archive`, { cookie: colleague.cookie })).status).toBe(403);
    expect((await call('DELETE', g, { cookie: colleague.cookie })).status).toBe(403);
    expect((await call('POST', `${g}/teachers`, { cookie: colleague.cookie, body: { login: 'kto-to' } })).status).toBe(403);
    expect((await call('DELETE', `${g}/teachers/${owner.teacher.id}`, { cookie: colleague.cookie })).status).toBe(403);
  });

  it('соавтор выходит сам или его убирает владелец; ошибки приглашения', async () => {
    const owner = await setupTeacher(['Маша Иванова']);
    const colleague = await setupTeacher(['Свой Ученик']);
    const g = `/api/teacher/groups/${owner.group.id}`;
    const login = await loginOf(colleague.teacher.id);

    expect((await call('POST', `${g}/teachers`, { cookie: owner.cookie, body: { login: 'net-takogo' } })).status).toBe(404);
    expect((await call('POST', `${g}/teachers`, { cookie: owner.cookie, body: { login: owner.students[0].login } })).status).toBe(404);
    expect((await call('POST', `${g}/teachers`, { cookie: owner.cookie, body: { login: await loginOf(owner.teacher.id) } })).status).toBe(400);
    await call('POST', `${g}/teachers`, { cookie: owner.cookie, body: { login } });
    expect((await call('POST', `${g}/teachers`, { cookie: owner.cookie, body: { login } })).status).toBe(409);

    // Выход из группы
    expect((await call('DELETE', `${g}/teachers/${colleague.teacher.id}`, { cookie: colleague.cookie })).status).toBe(200);
    expect((await call('GET', g, { cookie: colleague.cookie })).status).toBe(404);

    // Владелец убирает соавтора
    await call('POST', `${g}/teachers`, { cookie: owner.cookie, body: { login } });
    expect((await call('DELETE', `${g}/teachers/${colleague.teacher.id}`, { cookie: owner.cookie })).status).toBe(200);
    expect((await call('GET', `/api/teacher/students/${owner.students[0].id}/profile`, { cookie: colleague.cookie })).status).toBe(404);
  });
});
