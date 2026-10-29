import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { call, login, setupTeacher } from './helpers.js';

describe('родители', () => {
  it('преподаватель выдаёт доступ, родитель видит только своего ребёнка', async () => {
    const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов']);
    const [masha, petya] = t.students;
    const issued = await call('POST', `/api/teacher/students/${masha.id}/parents`, { cookie: t.cookie });
    expect(issued.status).toBe(200);
    expect(issued.body.login).toMatch(/^parent\.masha\.i\d*$/);
    expect(issued.body.studentName).toBe('Маша Иванова');

    const cookie = await login(issued.body.login, issued.body.password);
    const me = await call('GET', '/api/auth/me', { cookie });
    expect(me.body.user).toMatchObject({ role: 'PARENT', name: 'Родитель: Маша Иванова' });

    const children = await call('GET', '/api/parent/children', { cookie });
    expect(children.body.map((c: { id: string }) => c.id)).toEqual([masha.id]);
    expect((await call('GET', `/api/parent/children/${masha.id}/profile`, { cookie })).status).toBe(200);
    // Чужой ребёнок — как несуществующий
    expect((await call('GET', `/api/parent/children/${petya.id}/profile`, { cookie })).status).toBe(404);
    // Ни API преподавателя, ни API ученика
    expect((await call('GET', '/api/teacher/groups', { cookie })).status).toBe(403);
    expect((await call('GET', '/api/student/profile', { cookie })).status).toBe(403);
  });

  it('один вход на братьев и сестёр; привязать можно только своего родителя', async () => {
    const t = await setupTeacher(['Маша Иванова', 'Ваня Иванов']);
    const other = await setupTeacher(['Чужой Ученик']);
    const [masha, vanya] = t.students;
    const issued = (await call('POST', `/api/teacher/students/${masha.id}/parents`, { cookie: t.cookie })).body;

    const linked = await call('POST', `/api/teacher/students/${vanya.id}/parents/link`, { cookie: t.cookie, body: { login: issued.login } });
    expect(linked.status).toBe(200);
    expect(linked.body[0].otherChildren).toEqual([{ id: masha.id, name: 'Маша Иванова' }]);
    const cookie = await login(issued.login, issued.password);
    expect((await call('GET', '/api/parent/children', { cookie })).body).toHaveLength(2);

    // Повторная привязка — 409; чужой преподаватель не может привязать этого родителя к своему ученику
    expect((await call('POST', `/api/teacher/students/${vanya.id}/parents/link`, { cookie: t.cookie, body: { login: issued.login } })).status).toBe(409);
    const foreign = await call('POST', `/api/teacher/students/${other.students[0].id}/parents/link`, { cookie: other.cookie, body: { login: issued.login } });
    expect(foreign.status).toBe(404);
    // И не видит его учеников
    expect((await call('GET', `/api/teacher/students/${masha.id}/parents`, { cookie: other.cookie })).status).toBe(404);
  });

  it('отвязка последнего ребёнка удаляет вход родителя; сброс пароля завершает его сессии', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const masha = t.students[0];
    const issued = (await call('POST', `/api/teacher/students/${masha.id}/parents`, { cookie: t.cookie })).body;
    const cookie = await login(issued.login, issued.password);

    const reset = await call('POST', `/api/teacher/students/${masha.id}/parents/${issued.parentId}/reset-password`, { cookie: t.cookie });
    expect(reset.status).toBe(200);
    expect(reset.body.password).not.toBe(issued.password);
    expect((await call('GET', '/api/parent/children', { cookie })).status).toBe(401);

    const removed = await call('DELETE', `/api/teacher/students/${masha.id}/parents/${issued.parentId}`, { cookie: t.cookie });
    expect(removed.body).toEqual([]);
    expect(await prisma.account.findUnique({ where: { login: issued.login } })).toBeNull();
  });

  it('доступ для всей группы выдаётся только тем, у кого его нет; при удалении ученика вход родителя убирается', async () => {
    const t = await setupTeacher(['Маша Иванова', 'Петя Смирнов', 'Оля Котова']);
    await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie });
    const bulk = await call('POST', `/api/teacher/groups/${t.group.id}/parents`, { cookie: t.cookie });
    expect(bulk.body.credentials.map((c: { studentName: string }) => c.studentName)).toEqual(['Оля Котова', 'Петя Смирнов']);

    const group = await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie });
    expect(group.body.students.every((s: { parentsCount: number }) => s.parentsCount === 1)).toBe(true);

    const petyaParent = bulk.body.credentials.find((c: { studentName: string }) => c.studentName === 'Петя Смирнов');
    await call('DELETE', `/api/teacher/students/${t.students[1].id}`, { cookie: t.cookie });
    expect(await prisma.account.findUnique({ where: { login: petyaParent.login } })).toBeNull();
  });

  it('в архивной группе новый доступ не выдаётся', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
    expect((await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).status).toBe(409);
    expect((await call('POST', `/api/teacher/groups/${t.group.id}/parents`, { cookie: t.cookie })).status).toBe(409);
  });
});
