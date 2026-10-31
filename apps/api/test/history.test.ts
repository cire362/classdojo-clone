import { describe, expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { call, setupTeacher } from './helpers.js';

describe('исправление истории', () => {
  it('история показывает автора ручных баллов и посещения во всех кабинетах', async () => {
    const owner = await setupTeacher(['Маша Иванова']);
    const colleague = await setupTeacher(['Свой Ученик']);
    await prisma.teacher.update({ where: { id: colleague.teacher.id }, data: { name: 'Игорь Павлович' } });
    await prisma.groupTeacher.create({ data: { groupId: owner.group.id, teacherId: colleague.teacher.id } });
    const studentId = owner.students[0].id;
    await call('POST', `/api/teacher/groups/${owner.group.id}/points`, {
      cookie: colleague.cookie, body: { studentIds: [studentId], reasonId: owner.plusReason.id },
    });
    await call('POST', `/api/teacher/groups/${owner.group.id}/attendance`, {
      cookie: owner.cookie, body: { presentStudentIds: [studentId], peopleOnPhoto: null, subtractedTeacher: false },
    });
    // Старое событие без автора остаётся читаемым.
    await prisma.pointEvent.create({ data: { studentId, value: 1, reasonName: 'Старая запись', emoji: '⭐' } });
    for (const [path, cookie] of [
      [`/api/teacher/students/${studentId}/profile`, owner.cookie],
      ['/api/student/profile', await owner.studentCookie(0)],
    ]) {
      const profile = (await call('GET', path, { cookie })).body;
      expect(profile.history.find((e: { reasonName: string }) => e.reasonName === owner.plusReason.name).author).toBe('Игорь Павлович');
      expect(profile.history.find((e: { attendance: boolean }) => e.attendance).author).toBe(owner.teacher.name);
      expect(profile.history.find((e: { reasonName: string }) => e.reasonName === 'Старая запись').author).toBeNull();
      // В ответе нет данных входа начислившего преподавателя.
      expect(profile.history[0]).not.toHaveProperty('awardedBy');
    }
  });

  it('преподаватель удаляет ошибочное начисление из профиля ученика', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const sid = t.students[0].id;
    const award = async (reasonId: string) =>
      (await call('POST', `/api/teacher/groups/${t.group.id}/points`, { cookie: t.cookie, body: { studentIds: [sid], reasonId } })).body
        .eventIds[0] as string;
    await award(t.plus2Reason.id);
    const wrong = await award(t.minusReason.id);

    const del = await call('DELETE', `/api/teacher/points/${wrong}`, { cookie: t.cookie });
    expect(del.status).toBe(200);
    expect(del.body.summaries[sid]).toMatchObject({ totalEarned: 2 });

    const profile = await call('GET', `/api/teacher/students/${sid}/profile`, { cookie: t.cookie });
    expect(profile.body.history.map((e: any) => e.id)).not.toContain(wrong);
    expect(profile.body.points.total).toEqual({ earned: 2, lost: 0, net: 2 });
    expect(profile.body.history[0]).toMatchObject({ attendance: false });
  });

  it('баллы за посещение из истории не удаляются', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const sid = t.students[0].id;
    await call('POST', `/api/teacher/groups/${t.group.id}/attendance`, {
      cookie: t.cookie,
      body: { presentStudentIds: [sid], peopleOnPhoto: null, subtractedTeacher: false },
    });
    const profile = await call('GET', `/api/teacher/students/${sid}/profile`, { cookie: t.cookie });
    const att = profile.body.history.find((e: any) => e.attendance);
    expect(att).toBeTruthy();
    const del = await call('DELETE', `/api/teacher/points/${att.id}`, { cookie: t.cookie });
    expect(del.status).toBe(409);
    expect(await prisma.pointEvent.count({ where: { id: att.id } })).toBe(1);
  });

  it('чужой преподаватель и ученик удалить запись не могут', async () => {
    const a = await setupTeacher(['А Один']);
    const b = await setupTeacher(['Б Один']);
    const award = await call('POST', `/api/teacher/groups/${a.group.id}/points`, {
      cookie: a.cookie,
      body: { studentIds: [a.students[0].id], reasonId: a.minusReason.id },
    });
    const eventId = award.body.eventIds[0];
    expect((await call('DELETE', `/api/teacher/points/${eventId}`, { cookie: b.cookie })).status).toBe(404);
    const studentCookie = await a.studentCookie(0);
    expect((await call('DELETE', `/api/teacher/points/${eventId}`, { cookie: studentCookie })).status).toBe(403);
    expect(await prisma.pointEvent.count({ where: { id: eventId } })).toBe(1);
  });
});
