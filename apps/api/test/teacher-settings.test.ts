import { describe, expect, it } from 'vitest';
import { call, login, setupTeacher } from './helpers.js';
import { prisma } from '../src/platform/db.js';

const PASSWORD = 'teacher-pass-123';

describe('настройки преподавателя', () => {
  it('смена пароля: старый перестаёт работать, текущая сессия жива, другие завершены', async () => {
    const t = await setupTeacher([]);
    const account = await prisma.account.findUniqueOrThrow({ where: { id: t.teacher.accountId } });
    const otherDevice = await login(account.login, PASSWORD);

    const res = await call('POST', '/api/teacher/me/password', {
      cookie: t.cookie,
      body: { currentPassword: PASSWORD, newPassword: 'новый-пароль-42' },
    });
    expect(res.status).toBe(200);
    expect((await call('GET', '/api/teacher/groups', { cookie: t.cookie })).status).toBe(200);
    expect((await call('GET', '/api/teacher/groups', { cookie: otherDevice })).status).toBe(401);
    expect((await call('POST', '/api/auth/login', { body: { login: account.login, password: PASSWORD } })).status).toBe(401);
    await login(account.login, 'новый-пароль-42');
  });

  it('неверный текущий, короткий и совпадающий пароль отклоняются', async () => {
    const t = await setupTeacher([]);
    const post = (currentPassword: string, newPassword: string) =>
      call('POST', '/api/teacher/me/password', { cookie: t.cookie, body: { currentPassword, newPassword } });
    const wrong = await post('не-тот', 'новый-пароль-42');
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toMatch(/Текущий пароль/);
    expect((await post(PASSWORD, 'short')).status).toBe(400);
    expect((await post(PASSWORD, PASSWORD)).status).toBe(400);
  });

  it('смена имени', async () => {
    const t = await setupTeacher([]);
    const res = await call('PATCH', '/api/teacher/me', { cookie: t.cookie, body: { name: '  Ирина Павловна ' } });
    expect(res.body.name).toBe('Ирина Павловна');
    const me = await call('GET', '/api/auth/me', { cookie: t.cookie });
    expect(me.body.user.name).toBe('Ирина Павловна');
    expect((await call('PATCH', '/api/teacher/me', { cookie: t.cookie, body: { name: '  ' } })).status).toBe(400);
  });

  it('ученик не может менять пароль и имя через API преподавателя', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const cookie = await t.studentCookie(0);
    expect((await call('PATCH', '/api/teacher/me', { cookie, body: { name: 'x' } })).status).toBe(403);
    expect(
      (await call('POST', '/api/teacher/me/password', { cookie, body: { currentPassword: t.students[0].password, newPassword: 'aaaaaaaaaa' } }))
        .status,
    ).toBe(403);
  });
});
