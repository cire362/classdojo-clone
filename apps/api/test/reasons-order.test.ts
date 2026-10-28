import { describe, expect, it } from 'vitest';
import { call, setupTeacher } from './helpers.js';

describe('порядок причин', () => {
  it('сохраняется и применяется в списке причин и на экране урока', async () => {
    const t = await setupTeacher([]);
    const list = (await call('GET', `/api/teacher/groups/${t.group.id}/reasons`, { cookie: t.cookie })).body as { id: string }[];
    const reversed = [...list].reverse().map((r) => r.id);
    const res = await call('PUT', `/api/teacher/groups/${t.group.id}/reasons/order`, { cookie: t.cookie, body: { reasonIds: reversed } });
    expect(res.status).toBe(200);
    const after = (await call('GET', `/api/teacher/groups/${t.group.id}/reasons`, { cookie: t.cookie })).body.map((r: any) => r.id);
    expect(after).toEqual(reversed);
    const group = await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie });
    expect(group.body.reasons.map((r: any) => r.id)).toEqual(reversed);

    // Новая причина встаёт в конец
    const created = await call('POST', `/api/teacher/groups/${t.group.id}/reasons`, {
      cookie: t.cookie,
      body: { name: 'Новая', emoji: '🎯', value: 1 },
    });
    const withNew = (await call('GET', `/api/teacher/groups/${t.group.id}/reasons`, { cookie: t.cookie })).body.map((r: any) => r.id);
    expect(withNew.at(-1)).toBe(created.body.id);
  });

  it('неполный, повторяющийся или чужой список отклоняется', async () => {
    const a = await setupTeacher([]);
    const b = await setupTeacher([]);
    const ids = (await call('GET', `/api/teacher/groups/${a.group.id}/reasons`, { cookie: a.cookie })).body.map((r: any) => r.id);
    const put = (cookie: string, groupId: string, reasonIds: string[]) =>
      call('PUT', `/api/teacher/groups/${groupId}/reasons/order`, { cookie, body: { reasonIds } });
    expect((await put(a.cookie, a.group.id, ids.slice(1))).status).toBe(409);
    expect((await put(a.cookie, a.group.id, [ids[0], ...ids.slice(0, -1)])).status).toBe(409);
    expect((await put(a.cookie, a.group.id, [...ids.slice(1), b.plusReason.id])).status).toBe(409);
    expect((await put(b.cookie, a.group.id, ids)).status).toBe(404);
    expect((await put(await (async () => { const s = await setupTeacher(['У']); return s.studentCookie(0); })(), a.group.id, ids)).status).toBe(403);
  });
});
