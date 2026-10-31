import { describe, expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { call, setupTeacher } from './helpers.js';

describe('перевод ученика в другую группу', () => {
  it('ученик переходит со всей историей, героем и логином', async () => {
    const t = await setupTeacher(['Ученик Один', 'Ученик Два']);
    const [a] = t.students;
    await call('POST', `/api/teacher/groups/${t.group.id}/points`, { cookie: t.cookie, body: { studentIds: [a.id], reasonId: t.plus2Reason.id } });
    await call('POST', `/api/teacher/groups/${t.group.id}/attendance`, {
      cookie: t.cookie,
      body: { presentStudentIds: [a.id], peopleOnPhoto: null, subtractedTeacher: false },
    });
    const created = await call('POST', '/api/teacher/groups', { cookie: t.cookie, body: { name: 'Новая' } });
    const target = created.body.id;

    const res = await call('POST', `/api/teacher/students/${a.id}/move`, { cookie: t.cookie, body: { groupId: target } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ groupId: target, groupName: 'Новая' });

    const oldGroup = await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie });
    expect(oldGroup.body.students.map((s: any) => s.id)).not.toContain(a.id);
    const newGroup = await call('GET', `/api/teacher/groups/${target}`, { cookie: t.cookie });
    const moved = newGroup.body.students.find((s: any) => s.id === a.id);
    expect(moved).toMatchObject({ totalEarned: 3, login: a.login });

    // Ученик входит тем же логином и видит свою историю и посещаемость
    const cookie = await t.studentCookie(0);
    const me = await call('GET', '/api/student/profile', { cookie });
    expect(me.body.student.group.name).toBe('Новая');
    expect(me.body.points.total.earned).toBe(3);
    expect(me.body.attendance.attended).toBe(1);

    // Начислять теперь можно только по причинам новой группы
    const oldReason = await call('POST', `/api/teacher/groups/${target}/points`, {
      cookie: t.cookie,
      body: { studentIds: [a.id], reasonId: t.plusReason.id },
    });
    expect(oldReason.status).toBe(404);
    const viaOldGroup = await call('POST', `/api/teacher/groups/${t.group.id}/points`, {
      cookie: t.cookie,
      body: { studentIds: [a.id], reasonId: t.plusReason.id },
    });
    expect(viaOldGroup.status).toBe(404);
  });

  it('в ту же группу, в чужую группу и учеником перевести нельзя', async () => {
    const a = await setupTeacher(['А Один']);
    const b = await setupTeacher(['Б Один']);
    const sid = a.students[0].id;
    expect((await call('POST', `/api/teacher/students/${sid}/move`, { cookie: a.cookie, body: { groupId: a.group.id } })).status).toBe(400);
    expect((await call('POST', `/api/teacher/students/${sid}/move`, { cookie: a.cookie, body: { groupId: b.group.id } })).status).toBe(404);
    expect((await call('POST', `/api/teacher/students/${b.students[0].id}/move`, { cookie: a.cookie, body: { groupId: a.group.id } })).status).toBe(404);
    const sc = await a.studentCookie(0);
    expect((await call('POST', `/api/teacher/students/${sid}/move`, { cookie: sc, body: { groupId: a.group.id } })).status).toBe(403);
    const s = await prisma.student.findUniqueOrThrow({ where: { id: sid } });
    expect(s.groupId).toBe(a.group.id);
  });

  it('команда принадлежит старой группе: после перевода ученик без команды', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const target = await prisma.group.create({ data: { name: 'Новая группа', teacherId: t.teacher.id } });
    const sid = t.students[0].id;
    const [team] = (await call('POST', `/api/teacher/groups/${t.group.id}/teams`, { cookie: t.cookie, body: { name: 'Кометы' } })).body;
    await call('PUT', `/api/teacher/groups/${t.group.id}/teams/assign`, { cookie: t.cookie, body: { assignments: { [sid]: team.id } } });

    expect((await call('POST', `/api/teacher/students/${sid}/move`, { cookie: t.cookie, body: { groupId: target.id } })).status).toBe(200);
    const moved = (await call('GET', `/api/teacher/groups/${target.id}`, { cookie: t.cookie })).body.students[0];
    expect(moved.teamId).toBeNull();
  });
});
