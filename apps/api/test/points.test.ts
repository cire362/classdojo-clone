import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { call, setupTeacher } from './helpers.js';

describe('начисление баллов', () => {
  it('начисляет баллы нескольким ученикам разом', async () => {
    const t = await setupTeacher();
    const ids = t.students.map((s) => s.id);
    const res = await call('POST', `/api/teacher/groups/${t.group.id}/points`, {
      cookie: t.cookie,
      body: { studentIds: ids, reasonId: t.plus2Reason.id },
    });
    expect(res.status).toBe(201);
    expect(res.body.eventIds).toHaveLength(3);
    for (const id of ids) expect(res.body.summaries[id]).toMatchObject({ todayEarned: 2, totalEarned: 2 });

    const events = await prisma.pointEvent.findMany({ where: { studentId: { in: ids } } });
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.value === 2 && e.reasonName === t.plus2Reason.name)).toBe(true);
  });

  it('списание не уменьшает «заработано» и уровень, но видно в истории ученика', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const sid = t.students[0].id;
    for (let i = 0; i < 6; i++) {
      await call('POST', `/api/teacher/groups/${t.group.id}/points`, {
        cookie: t.cookie,
        body: { studentIds: [sid], reasonId: t.plus2Reason.id },
      });
    }
    const before = await call('GET', `/api/teacher/students/${sid}/profile`, { cookie: t.cookie });
    expect(before.body.level.level).toBe(2); // 12 баллов ≥ порога 10

    const minus = await call('POST', `/api/teacher/groups/${t.group.id}/points`, {
      cookie: t.cookie,
      body: { studentIds: [sid], reasonId: t.minusReason.id },
    });
    expect(minus.status).toBe(201);
    expect(minus.body.summaries[sid]).toMatchObject({ todayEarned: 12, totalEarned: 12, level: 2 });

    const studentCookie = await t.studentCookie(0);
    const me = await call('GET', '/api/student/profile', { cookie: studentCookie });
    expect(me.body.level.level).toBe(2);
    expect(me.body.points.total).toEqual({ earned: 12, lost: 1, net: 11 });
    expect(me.body.points.today).toEqual({ earned: 12, lost: 1, net: 11 });
    expect(me.body.history[0]).toMatchObject({ value: -1, reasonName: t.minusReason.name });
  });

  it('отмена последнего начисления', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const sid = t.students[0].id;
    const res = await call('POST', `/api/teacher/groups/${t.group.id}/points`, {
      cookie: t.cookie,
      body: { studentIds: [sid], reasonId: t.plusReason.id },
    });
    const undo = await call('POST', '/api/teacher/points/undo', { cookie: t.cookie, body: { eventIds: res.body.eventIds } });
    expect(undo.status).toBe(200);
    expect(undo.body.summaries[sid].totalEarned).toBe(0);
  });

  it('нельзя начислить по причине из чужой группы или ученику из другой группы', async () => {
    const a = await setupTeacher(['А Один']);
    const b = await setupTeacher(['Б Один']);
    const foreignReason = await call('POST', `/api/teacher/groups/${a.group.id}/points`, {
      cookie: a.cookie,
      body: { studentIds: [a.students[0].id], reasonId: b.plusReason.id },
    });
    expect(foreignReason.status).toBe(404);

    const foreignStudent = await call('POST', `/api/teacher/groups/${a.group.id}/points`, {
      cookie: a.cookie,
      body: { studentIds: [b.students[0].id], reasonId: a.plusReason.id },
    });
    expect(foreignStudent.status).toBe(404);
    expect(await prisma.pointEvent.count({ where: { studentId: b.students[0].id } })).toBe(0);
  });

  it('нельзя вручную начислить по системной причине «Посещение»', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const att = await prisma.behaviorReason.findFirstOrThrow({ where: { groupId: t.group.id, kind: 'ATTENDANCE' } });
    const res = await call('POST', `/api/teacher/groups/${t.group.id}/points`, {
      cookie: t.cookie,
      body: { studentIds: [t.students[0].id], reasonId: att.id },
    });
    expect(res.status).toBe(404);
  });

  it('удалённая причина пропадает из списка, но остаётся в истории', async () => {
    const t = await setupTeacher(['Ученик Один']);
    await call('POST', `/api/teacher/groups/${t.group.id}/points`, {
      cookie: t.cookie,
      body: { studentIds: [t.students[0].id], reasonId: t.plusReason.id },
    });
    expect((await call('DELETE', `/api/teacher/reasons/${t.plusReason.id}`, { cookie: t.cookie })).status).toBe(200);
    const reasons = await call('GET', `/api/teacher/groups/${t.group.id}/reasons`, { cookie: t.cookie });
    expect(reasons.body.find((r: any) => r.id === t.plusReason.id)).toBeUndefined();
    const profile = await call('GET', `/api/teacher/students/${t.students[0].id}/profile`, { cookie: t.cookie });
    expect(profile.body.history[0].reasonName).toBe(t.plusReason.name);
  });

  it('нулевое значение причины запрещено', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const res = await call('POST', `/api/teacher/groups/${t.group.id}/reasons`, {
      cookie: t.cookie,
      body: { name: 'Пусто', emoji: '🙂', value: 0 },
    });
    expect(res.status).toBe(400);
  });
});

describe('посещаемость', () => {
  it('присутствующие получают +1 «Посещение», повторное сохранение не дублирует баллы', async () => {
    const t = await setupTeacher();
    const [a, b, c] = t.students;
    const save = (present: string[]) =>
      call('POST', `/api/teacher/groups/${t.group.id}/attendance`, {
        cookie: t.cookie,
        body: { presentStudentIds: present, peopleOnPhoto: present.length + 1, subtractedTeacher: true },
      });

    const first = await save([a.id, b.id]);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ presentCount: 2, studentsTotal: 3 });

    const second = await save([a.id, c.id]);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);

    const att = (id: string) => prisma.pointEvent.count({ where: { studentId: id, reasonName: 'Посещение' } });
    expect(await att(a.id)).toBe(1);
    expect(await att(b.id)).toBe(0);
    expect(await att(c.id)).toBe(1);

    const group = await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie });
    expect(group.body.todayAttendance.presentStudentIds.sort()).toEqual([a.id, c.id].sort());
  });

  it('статистика и выгрузка в Excel', async () => {
    const t = await setupTeacher(['Ученик Один', 'Ученик Два']);
    await call('POST', `/api/teacher/groups/${t.group.id}/attendance`, {
      cookie: t.cookie,
      body: { presentStudentIds: [t.students[0].id], peopleOnPhoto: null, subtractedTeacher: false },
    });
    await call('POST', `/api/teacher/groups/${t.group.id}/points`, {
      cookie: t.cookie,
      body: { studentIds: [t.students[1].id], reasonId: t.minusReason.id },
    });
    const stats = await call('GET', `/api/teacher/groups/${t.group.id}/stats`, { cookie: t.cookie });
    expect(stats.status).toBe(200);
    const one = stats.body.students.find((s: any) => s.id === t.students[0].id);
    const two = stats.body.students.find((s: any) => s.id === t.students[1].id);
    expect(one).toMatchObject({ earned: 1, lost: 0, attended: 1, sessions: 1 });
    expect(two).toMatchObject({ earned: 0, lost: 1, net: -1, attended: 0, sessions: 1 });

    const xlsx = await call('GET', `/api/teacher/groups/${t.group.id}/stats.xlsx`, { cookie: t.cookie });
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers.get('content-type')).toContain('spreadsheetml');
    const bytes = new Uint8Array(xlsx.body as ArrayBuffer);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK'); // xlsx — это zip
  });
});
