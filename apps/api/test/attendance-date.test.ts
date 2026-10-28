import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { addDays, dateKey, localDayStart, startOfDay } from '../src/lib/dates.js';
import { call, setupTeacher } from './helpers.js';

const daysAgo = (n: number) => dateKey(addDays(startOfDay(), -n));

describe('посещаемость за прошлую дату', () => {
  it('отметка задним числом: сессия на нужную дату, баллы датированы днём урока', async () => {
    const t = await setupTeacher(['Ученик Один', 'Ученик Два']);
    const [a, b] = t.students;
    const date = daysAgo(3);
    const res = await call('POST', `/api/teacher/groups/${t.group.id}/attendance`, {
      cookie: t.cookie,
      body: { date, presentStudentIds: [a.id], peopleOnPhoto: 2, subtractedTeacher: true },
    });
    expect(res.status).toBe(201);
    expect(res.body.date).toBe(date);

    const ev = await prisma.pointEvent.findFirstOrThrow({ where: { studentId: a.id, reasonName: 'Посещение' } });
    expect(dateKey(ev.createdAt)).toBe(date);
    expect(ev.createdAt >= localDayStart(date)).toBe(true);

    // В «сегодня» эти баллы не попадают, а в статистику за тот день — попадают
    const group = await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie });
    expect(group.body.students.find((s: any) => s.id === a.id).todayEarned).toBe(0);
    expect(group.body.todayAttendance).toBeNull();
    const stats = await call('GET', `/api/teacher/groups/${t.group.id}/stats?from=${date}&to=${date}`, { cookie: t.cookie });
    expect(stats.body.students.find((s: any) => s.id === a.id)).toMatchObject({ earned: 1, attended: 1, sessions: 1 });
    expect(stats.body.students.find((s: any) => s.id === b.id)).toMatchObject({ earned: 0, attended: 0, sessions: 1 });
  });

  it('чтение отметки за дату и её перезапись', async () => {
    const t = await setupTeacher(['Ученик Один', 'Ученик Два']);
    const [a, b] = t.students;
    const date = daysAgo(1);
    const empty = await call('GET', `/api/teacher/groups/${t.group.id}/attendance?date=${date}`, { cookie: t.cookie });
    expect(empty.body).toEqual({ date, lesson: 1, lessons: [], session: null });

    const save = (present: string[]) =>
      call('POST', `/api/teacher/groups/${t.group.id}/attendance`, {
        cookie: t.cookie,
        body: { date, presentStudentIds: present, peopleOnPhoto: null, subtractedTeacher: false },
      });
    await save([a.id]);
    await save([b.id]);
    const got = await call('GET', `/api/teacher/groups/${t.group.id}/attendance?date=${date}`, { cookie: t.cookie });
    expect(got.body.session.presentStudentIds).toEqual([b.id]);
    expect([...got.body.session.markedStudentIds].sort()).toEqual([a.id, b.id].sort());
    expect(await prisma.pointEvent.count({ where: { studentId: { in: [a.id, b.id] }, reasonName: 'Посещение' } })).toBe(1);
  });

  it('будущее, слишком старые даты и неверный формат отклоняются', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const post = (date: string) =>
      call('POST', `/api/teacher/groups/${t.group.id}/attendance`, {
        cookie: t.cookie,
        body: { date, presentStudentIds: [], peopleOnPhoto: null, subtractedTeacher: false },
      });
    expect((await post(dateKey(addDays(startOfDay(), 1)))).status).toBe(400);
    expect((await post(daysAgo(400))).status).toBe(400);
    expect((await post('28.10.2026')).status).toBe(400);
    expect((await call('GET', `/api/teacher/groups/${t.group.id}/attendance?date=вчера`, { cookie: t.cookie })).status).toBe(400);
  });

  it('чужой преподаватель и ученик не видят отметку', async () => {
    const a = await setupTeacher(['А Один']);
    const b = await setupTeacher(['Б Один']);
    expect((await call('GET', `/api/teacher/groups/${a.group.id}/attendance`, { cookie: b.cookie })).status).toBe(404);
    const sc = await a.studentCookie(0);
    expect((await call('GET', `/api/teacher/groups/${a.group.id}/attendance`, { cookie: sc })).status).toBe(403);
  });
});
