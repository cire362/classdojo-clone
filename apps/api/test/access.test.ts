import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HERO } from '@heroes/shared';
import { prisma } from '../src/db.js';
import { call, login, setupTeacher } from './helpers.js';

describe('авторизация', () => {
  it('без входа API закрыт', async () => {
    expect((await call('GET', '/api/teacher/groups')).status).toBe(401);
    expect((await call('GET', '/api/student/profile')).status).toBe(401);
    expect((await call('GET', '/api/hero-parts')).status).toBe(401);
  });

  it('неверный пароль', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const res = await call('POST', '/api/auth/login', { body: { login: t.students[0].login, password: 'nope' } });
    expect(res.status).toBe(401);
  });

  it('cookie сессии — httpOnly и SameSite', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const res = await call('POST', '/api/auth/login', {
      body: { login: t.students[0].login, password: t.students[0].password },
    });
    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('выход завершает сессию', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const cookie = await t.studentCookie(0);
    await call('POST', '/api/auth/logout', { cookie });
    expect((await call('GET', '/api/student/profile', { cookie })).status).toBe(401);
  });

  it('изменяющие запросы без служебного заголовка отклоняются (CSRF)', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const res = await call('POST', `/api/teacher/groups/${t.group.id}/points`, {
      cookie: t.cookie,
      body: { studentIds: [t.students[0].id], reasonId: t.plusReason.id },
      noClientHeader: true,
    });
    expect(res.status).toBe(403);
  });

  it('сброс пароля завершает сессии ученика и старый пароль перестаёт работать', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const s = t.students[0];
    const cookie = await t.studentCookie(0);
    const reset = await call('POST', `/api/teacher/students/${s.id}/reset-password`, { cookie: t.cookie });
    expect(reset.status).toBe(200);
    expect(reset.body.password).not.toBe(s.password);
    expect((await call('GET', '/api/student/profile', { cookie })).status).toBe(401);
    const old = await call('POST', '/api/auth/login', { body: { login: s.login, password: s.password } });
    expect(old.status).toBe(401);
    await login(s.login, reset.body.password);
  });
});

describe('права ученика', () => {
  it('ученик не может вызывать API преподавателя', async () => {
    const t = await setupTeacher();
    const cookie = await t.studentCookie(0);
    const sid = t.students[0].id;
    const attempts: [string, string, unknown?][] = [
      ['GET', '/api/teacher/groups'],
      ['GET', `/api/teacher/groups/${t.group.id}`],
      ['POST', `/api/teacher/groups/${t.group.id}/points`, { studentIds: [sid], reasonId: t.plusReason.id }],
      ['POST', `/api/teacher/groups/${t.group.id}/attendance`, { presentStudentIds: [sid], peopleOnPhoto: 1, subtractedTeacher: false }],
      ['GET', `/api/teacher/students/${t.students[1].id}/profile`],
      ['PUT', `/api/teacher/students/${sid}/hero`, { name: 'x', parts: DEFAULT_HERO }],
      ['POST', `/api/teacher/students/${sid}/reset-password`],
      ['DELETE', `/api/teacher/students/${t.students[1].id}`],
      ['GET', `/api/teacher/groups/${t.group.id}/stats`],
      ['GET', `/api/teacher/groups/${t.group.id}/stats.xlsx`],
    ];
    for (const [method, path, body] of attempts) {
      const res = await call(method, path, { cookie, body });
      expect(res.status, `${method} ${path}`).toBe(403);
    }
    expect(await prisma.pointEvent.count({ where: { studentId: sid } })).toBe(0);
    expect(await prisma.student.count({ where: { id: t.students[1].id } })).toBe(1);
  });

  it('ученик видит только свои данные', async () => {
    const t = await setupTeacher();
    await call('POST', `/api/teacher/groups/${t.group.id}/points`, {
      cookie: t.cookie,
      body: { studentIds: [t.students[1].id], reasonId: t.plusReason.id },
    });
    const cookie = await t.studentCookie(0);
    const me = await call('GET', '/api/student/profile', { cookie });
    expect(me.status).toBe(200);
    expect(me.body.student.id).toBe(t.students[0].id);
    expect(me.body.history).toHaveLength(0);
    // Попытка подсунуть чужой id в параметрах игнорируется — маршрутов с чужим id у ученика нет
    const other = await call('GET', `/api/student/profile?studentId=${t.students[1].id}`, { cookie });
    expect(other.body.student.id).toBe(t.students[0].id);
  });

  it('ученик собирает героя, но не может взять закрытые детали', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const cookie = await t.studentCookie(0);
    const ok = await call('PUT', '/api/student/hero', {
      cookie,
      body: { name: 'Гроза Контрольных', parts: { ...DEFAULT_HERO, mask: 'mask.none', cape: 'cape.classic' } },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.name).toBe('Гроза Контрольных');

    const locked = await call('PUT', '/api/student/hero', {
      cookie,
      body: { name: 'Хитрец', parts: { ...DEFAULT_HERO, suitColor: 'color.gold' } },
    });
    expect(locked.status).toBe(422);

    const unknown = await call('PUT', '/api/student/hero', {
      cookie,
      body: { name: 'Хитрец', parts: { ...DEFAULT_HERO, mask: 'mask.something' } },
    });
    expect(unknown.status).toBe(422);

    const hero = await prisma.hero.findUniqueOrThrow({ where: { studentId: t.students[0].id } });
    expect(hero.name).toBe('Гроза Контрольных');
  });

  it('детали открываются с уровнем', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const sid = t.students[0].id;
    // 5 уровень = 70 баллов
    await prisma.pointEvent.create({ data: { studentId: sid, reasonName: 'Тест', emoji: '⭐', value: 70 } });
    const cookie = await t.studentCookie(0);
    const res = await call('PUT', '/api/student/hero', {
      cookie,
      body: { name: '', parts: { ...DEFAULT_HERO, suitColor: 'color.gold', mask: 'mask.helmet' } },
    });
    expect(res.status).toBe(200);
  });
});

describe('изоляция преподавателей', () => {
  it('преподаватель не видит чужие группы и учеников', async () => {
    const a = await setupTeacher(['А Один']);
    const b = await setupTeacher(['Б Один']);
    const bs = b.students[0].id;
    const attempts: [string, string, unknown?][] = [
      ['GET', `/api/teacher/groups/${b.group.id}`],
      ['PATCH', `/api/teacher/groups/${b.group.id}`, { name: 'Взлом' }],
      ['DELETE', `/api/teacher/groups/${b.group.id}`],
      ['POST', `/api/teacher/groups/${b.group.id}/students`, { names: ['Шпион'] }],
      ['POST', `/api/teacher/groups/${b.group.id}/points`, { studentIds: [bs], reasonId: b.plusReason.id }],
      ['GET', `/api/teacher/students/${bs}/profile`],
      ['PATCH', `/api/teacher/students/${bs}`, { name: 'Взлом' }],
      ['POST', `/api/teacher/students/${bs}/reset-password`],
      ['DELETE', `/api/teacher/students/${bs}`],
      ['PATCH', `/api/teacher/reasons/${b.plusReason.id}`, { name: 'x', emoji: 'x', value: 5 }],
      ['DELETE', `/api/teacher/reasons/${b.plusReason.id}`],
      ['GET', `/api/teacher/groups/${b.group.id}/stats`],
    ];
    for (const [method, path, body] of attempts) {
      const res = await call(method, path, { cookie: a.cookie, body });
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    const groups = await call('GET', '/api/teacher/groups', { cookie: a.cookie });
    expect(groups.body.map((g: any) => g.id)).toEqual([a.group.id]);
    expect(await prisma.student.count({ where: { id: bs } })).toBe(1);
  });

  it('отмена начисления из чужой группы невозможна', async () => {
    const a = await setupTeacher(['А Один']);
    const b = await setupTeacher(['Б Один']);
    const award = await call('POST', `/api/teacher/groups/${b.group.id}/points`, {
      cookie: b.cookie,
      body: { studentIds: [b.students[0].id], reasonId: b.plusReason.id },
    });
    const undo = await call('POST', '/api/teacher/points/undo', { cookie: a.cookie, body: { eventIds: award.body.eventIds } });
    expect(undo.status).toBe(404);
  });
});

describe('ученики и группы', () => {
  it('создание учеников списком: логины уникальны, пароли выдаются один раз', async () => {
    const t = await setupTeacher([]);
    const res = await call('POST', `/api/teacher/groups/${t.group.id}/students`, {
      cookie: t.cookie,
      body: { names: ['Маша Иванова', 'Маша Иванова', '  ', 'Артём'] },
    });
    expect(res.status).toBe(201);
    const creds = res.body.credentials;
    expect(creds).toHaveLength(3);
    expect(new Set(creds.map((c: any) => c.login)).size).toBe(3);
    const account = await prisma.account.findUniqueOrThrow({ where: { login: creds[0].login } });
    expect(account.passwordHash).not.toContain(creds[0].password);
    const group = await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie });
    expect(JSON.stringify(group.body)).not.toContain(creds[0].password);
    await login(creds[0].login, creds[0].password);
  });

  it('новая группа получает набор причин по умолчанию', async () => {
    const t = await setupTeacher([]);
    const res = await call('POST', '/api/teacher/groups', { cookie: t.cookie, body: { name: '6 «Б»' } });
    expect(res.status).toBe(201);
    const reasons = await call('GET', `/api/teacher/groups/${res.body.id}/reasons`, { cookie: t.cookie });
    expect(reasons.body.length).toBeGreaterThanOrEqual(8);
    expect(reasons.body.some((r: any) => r.value < 0)).toBe(true);
  });

  it('удаление группы удаляет и аккаунты учеников', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const del = await call('DELETE', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie });
    expect(del.status).toBe(200);
    expect(await prisma.account.count({ where: { login: t.students[0].login } })).toBe(0);
  });
});

describe('отметка по фото', () => {
  afterEach(() => vi.restoreAllMocks());

  it('фото уходит в сервис подсчёта и не сохраняется', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const realFetch = globalThis.fetch;
    let received: { type: string | null; size: number } | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (!url.endsWith('/count')) return realFetch(input, init);
      const body = init!.body as Blob;
      received = { type: new Headers(init!.headers).get('content-type'), size: body.size };
      return Response.json({ count: 2, width: 100, height: 80, boxes: [], elapsedMs: 5 });
    });

    const form = new FormData();
    form.append('photo', new File([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], 'class.jpg', { type: 'image/jpeg' }));
    const before = await prisma.attendanceSession.count();
    const res = await call('POST', `/api/teacher/groups/${t.group.id}/attendance/detect`, { cookie: t.cookie, raw: form });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(received).toEqual({ type: 'image/jpeg', size: 6 });
    // Определение не создаёт записей — сохраняется только итог отметки
    expect(await prisma.attendanceSession.count()).toBe(before);
  });

  it('не-изображение отклоняется', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const form = new FormData();
    form.append('photo', new File(['hello'], 'a.txt', { type: 'text/plain' }));
    const res = await call('POST', `/api/teacher/groups/${t.group.id}/attendance/detect`, { cookie: t.cookie, raw: form });
    expect(res.status).toBe(415);
  });

  it('сервис подсчёта недоступен — понятная ошибка', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).endsWith('/count')) throw new TypeError('fetch failed');
      return realFetch(input, init);
    });
    const form = new FormData();
    form.append('photo', new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }));
    const res = await call('POST', `/api/teacher/groups/${t.group.id}/attendance/detect`, { cookie: t.cookie, raw: form });
    expect(res.status).toBe(503);
  });
});
