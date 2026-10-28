import { describe, expect, it } from 'vitest';
import { call, setupTeacher } from './helpers.js';

describe('архив групп', () => {
  it('архивная группа только для просмотра, после возврата снова работает', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const sid = t.students[0].id;
    const g = t.group.id;
    const award = await call('POST', `/api/teacher/groups/${g}/points`, { cookie: t.cookie, body: { studentIds: [sid], reasonId: t.plusReason.id } });

    const arch = await call('POST', `/api/teacher/groups/${g}/archive`, { cookie: t.cookie });
    expect(arch.status).toBe(200);
    expect(arch.body.archivedAt).toBeTruthy();
    const list = await call('GET', '/api/teacher/groups', { cookie: t.cookie });
    expect(list.body.find((x: any) => x.id === g).archivedAt).toBeTruthy();

    // Просмотр, статистика, Excel и профиль доступны
    for (const path of [`/api/teacher/groups/${g}`, `/api/teacher/groups/${g}/stats`, `/api/teacher/groups/${g}/stats.xlsx`, `/api/teacher/students/${sid}/profile`]) {
      expect((await call('GET', path, { cookie: t.cookie })).status, path).toBe(200);
    }
    // Изменения запрещены
    const blocked: [string, string, unknown?][] = [
      ['POST', `/api/teacher/groups/${g}/points`, { studentIds: [sid], reasonId: t.plusReason.id }],
      ['POST', `/api/teacher/groups/${g}/attendance`, { presentStudentIds: [sid], peopleOnPhoto: null, subtractedTeacher: false }],
      ['POST', `/api/teacher/groups/${g}/students`, { names: ['Новый Ученик'] }],
      ['POST', `/api/teacher/groups/${g}/reasons`, { name: 'x', emoji: '⭐', value: 1 }],
      ['PATCH', `/api/teacher/reasons/${t.plusReason.id}`, { name: 'x', emoji: '⭐', value: 1 }],
      ['DELETE', `/api/teacher/reasons/${t.plusReason.id}`],
      ['DELETE', `/api/teacher/points/${award.body.eventIds[0]}`],
    ];
    for (const [method, path, body] of blocked) {
      const res = await call(method, path, { cookie: t.cookie, body });
      expect(res.status, `${method} ${path}`).toBe(409);
    }
    // Ученик архивной группы по-прежнему входит и видит кабинет
    const sc = await t.studentCookie(0);
    expect((await call('GET', '/api/student/profile', { cookie: sc })).status).toBe(200);

    expect((await call('POST', `/api/teacher/groups/${g}/restore`, { cookie: t.cookie })).body.archivedAt).toBeNull();
    const again = await call('POST', `/api/teacher/groups/${g}/points`, { cookie: t.cookie, body: { studentIds: [sid], reasonId: t.plusReason.id } });
    expect(again.status).toBe(201);
  });

  it('из архивной группы можно перевести ученика, в архивную — нельзя', async () => {
    const t = await setupTeacher(['Ученик Один', 'Ученик Два']);
    const other = (await call('POST', '/api/teacher/groups', { cookie: t.cookie, body: { name: 'Следующий год' } })).body.id;
    await call('POST', `/api/teacher/groups/${t.group.id}/archive`, { cookie: t.cookie });
    const out = await call('POST', `/api/teacher/students/${t.students[0].id}/move`, { cookie: t.cookie, body: { groupId: other } });
    expect(out.status).toBe(200);
    await call('POST', `/api/teacher/groups/${other}/archive`, { cookie: t.cookie });
    await call('POST', `/api/teacher/groups/${t.group.id}/restore`, { cookie: t.cookie });
    const into = await call('POST', `/api/teacher/students/${t.students[1].id}/move`, { cookie: t.cookie, body: { groupId: other } });
    expect(into.status).toBe(409);
  });

  it('чужой преподаватель не может архивировать', async () => {
    const a = await setupTeacher([]);
    const b = await setupTeacher([]);
    expect((await call('POST', `/api/teacher/groups/${a.group.id}/archive`, { cookie: b.cookie })).status).toBe(404);
    expect((await call('POST', `/api/teacher/groups/${a.group.id}/restore`, { cookie: b.cookie })).status).toBe(404);
  });
});
