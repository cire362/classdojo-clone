import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db.js';
import { weeklyPeriod } from '../src/services/weekly-summary.js';
import { call, login, setupTeacher } from './helpers.js';

async function family() {
  const t = await setupTeacher(['Маша Иванова', 'Ваня Иванов']);
  const issued = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  const cookie = await login(issued.login, issued.password);
  const path = `/api/parent/children/${t.students[0].id}/weekly-summary`;
  return { ...t, parentCookie: cookie, parent: issued, path };
}

describe('итог недели родителю', () => {
  it('только свой ребёнок, включая общего родителя; отвязка сразу закрывает доступ', async () => {
    const t = await family();
    const second = `/api/parent/children/${t.students[1].id}/weekly-summary`;
    expect((await call('GET', t.path, { cookie: t.parentCookie })).status).toBe(200);
    expect((await call('GET', second, { cookie: t.parentCookie })).status).toBe(404);
    expect((await call('GET', '/api/parent/children/missing/weekly-summary', { cookie: t.parentCookie })).status).toBe(404);
    expect((await call('GET', t.path)).status).toBe(401);
    expect((await call('GET', t.path, { cookie: t.cookie })).status).toBe(403);
    expect((await call('GET', t.path, { cookie: await t.studentCookie(0) })).status).toBe(403);
    await call('POST', `/api/teacher/students/${t.students[1].id}/parents/link`, { cookie: t.cookie, body: { login: t.parent.login } });
    expect((await call('GET', second, { cookie: t.parentCookie })).status).toBe(200);
    await call('DELETE', `/api/teacher/students/${t.students[1].id}/parents/${t.parent.parentId}`, { cookie: t.cookie });
    expect((await call('GET', second, { cookie: t.parentCookie })).status).toBe(404);
  });

  it('точные границы по Москве, смена года, снимки причин и раздельные плюсы/минусы', async () => {
    const t = await family();
    const studentId = t.students[0].id;
    await prisma.pointEvent.createMany({ data: [
      { studentId, reasonName: 'До недели', emoji: '⭐', value: 99, createdAt: new Date('2025-12-28T20:59:59.999Z') },
      { studentId, reasonName: 'Помощь', emoji: '⭐', value: 2, createdAt: new Date('2025-12-28T21:00:00Z') },
      { studentId, reasonName: 'Помощь', emoji: '⭐', value: 3, createdAt: new Date('2025-12-30T12:00:00Z') },
      { studentId, reasonName: 'Помощь', emoji: '⭐', value: -2, createdAt: new Date('2026-01-04T20:59:59.999Z') },
      { studentId, reasonName: 'Новая неделя', emoji: '⭐', value: 99, createdAt: new Date('2026-01-04T21:00:00Z') },
      { studentId: t.students[1].id, reasonName: 'Чужие баллы', emoji: '⭐', value: 99, createdAt: new Date('2026-01-01T12:00:00Z') },
    ] });
    const result = await call('GET', `${t.path}?week=2026-01-01`, { cookie: t.parentCookie });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ studentId, from: '2025-12-29', to: '2026-01-04', previousWeek: '2025-12-22', nextWeek: '2026-01-05', isCurrent: false, points: { earned: 5, lost: 2, net: 3, events: 3 } });
    expect(result.body.reasons).toEqual([{ name: 'Помощь', emoji: '⭐', earned: 5, lost: 2, count: 3 }]);
  });

  it('считает всю историю недели, даже если записей больше лимита профиля', async () => {
    const t = await family();
    await prisma.pointEvent.createMany({ data: Array.from({ length: 305 }, () => ({ studentId: t.students[0].id, reasonName: 'Работа на уроке', emoji: '⭐', value: 1, createdAt: new Date('2026-01-01T12:00:00Z') })) });
    const result = await call('GET', `${t.path}?week=2025-12-29`, { cookie: t.parentCookie });
    expect(result.body.points).toEqual({ earned: 305, lost: 0, net: 305, events: 305 });
    expect(result.body.reasons[0].count).toBe(305);
  });

  it('учитывает явные отметки и несколько уроков, сохраняет историю после перевода и исправлений', async () => {
    const t = await family();
    const studentId = t.students[0].id;
    const another = await prisma.group.create({ data: { name: 'Новая группа', teacherId: t.teacher.id } });
    const lesson = (groupId: string, date: string, lessonNumber: number, records: { studentId: string; present: boolean }[]) => prisma.attendanceSession.create({ data: { groupId, date: new Date(date), lessonNumber, studentsTotal: records.length, records: { create: records } } });
    await lesson(t.group.id, '2025-12-29', 1, [{ studentId, present: true }]);
    const missed = await lesson(t.group.id, '2025-12-29', 2, [{ studentId, present: false }]);
    await lesson(t.group.id, '2025-12-30', 1, [{ studentId: t.students[1].id, present: false }]);
    await lesson(t.group.id, '2026-01-05', 1, [{ studentId, present: false }]);
    await prisma.student.update({ where: { id: studentId }, data: { groupId: another.id } });
    await lesson(another.id, '2025-12-29', 1, [{ studentId, present: true }]);
    let result = await call('GET', `${t.path}?week=2025-12-29`, { cookie: t.parentCookie });
    expect(result.body.attendance).toMatchObject({ total: 3, attended: 2, missed: 1 });
    expect(result.body.attendance.records).toHaveLength(3);
    expect(new Set(result.body.attendance.records.map((r: { groupName: string }) => r.groupName))).toEqual(new Set(['Тестовая группа', 'Новая группа']));
    await prisma.attendance.update({ where: { sessionId_studentId: { sessionId: missed.id, studentId } }, data: { present: true } });
    const event = await prisma.pointEvent.create({ data: { studentId, reasonName: 'Ошибка', emoji: '⭐', value: -3, createdAt: new Date('2026-01-01T12:00:00Z') } });
    result = await call('GET', `${t.path}?week=2025-12-29`, { cookie: t.parentCookie });
    expect(result.body.attendance).toMatchObject({ total: 3, attended: 3, missed: 0 });
    expect(result.body.points.net).toBe(-3);
    await prisma.pointEvent.delete({ where: { id: event.id } });
    await prisma.group.update({ where: { id: another.id }, data: { archivedAt: new Date() } });
    result = await call('GET', `${t.path}?week=2025-12-29`, { cookie: t.parentCookie });
    expect(result.status).toBe(200);
    expect(result.body.points.net).toBe(0);
    expect(result.body.reasons).toEqual([]);
  });

  it('пустая текущая неделя — нули и отсутствие отметок, будущая неделя и неверные даты отклоняются', async () => {
    const t = await family();
    const result = await call('GET', t.path, { cookie: t.parentCookie });
    expect(result.body).toMatchObject({ isCurrent: true, nextWeek: null, points: { earned: 0, lost: 0, net: 0, events: 0 }, reasons: [], attendance: { total: 0, attended: 0, missed: 0, records: [] } });
    for (const week of ['abc', '', '2026-02-30', '2025-13-01', '9999-01-01']) {
      expect((await call('GET', `${t.path}?week=${week}`, { cookie: t.parentCookie })).status).toBe(400);
    }
  });

  it('воскресенье, понедельник по Москве и 29 февраля дают правильную неделю', () => {
    expect(weeklyPeriod(undefined, new Date('2026-10-25T20:59:59Z'))).toMatchObject({ from: '2026-10-19', to: '2026-10-25', nextWeek: null });
    expect(weeklyPeriod(undefined, new Date('2026-10-25T21:00:00Z'))).toMatchObject({ from: '2026-10-26', to: '2026-11-01', nextWeek: null });
    expect(weeklyPeriod('2024-02-29', new Date('2026-10-30T12:00:00Z'))).toMatchObject({ from: '2024-02-26', to: '2024-03-03' });
  });
});
