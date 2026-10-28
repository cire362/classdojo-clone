import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { prisma } from '../src/db.js';
import { addDays, dateKey, startOfDay } from '../src/lib/dates.js';
import { call, setupTeacher } from './helpers.js';

describe('несколько уроков в день', () => {
  it('два урока за день хранятся отдельно, баллы за каждый', async () => {
    const t = await setupTeacher(['Ученик Один', 'Ученик Два']);
    const [a, b] = t.students;
    const save = (lesson: number, present: string[]) =>
      call('POST', `/api/teacher/groups/${t.group.id}/attendance`, {
        cookie: t.cookie,
        body: { lesson, presentStudentIds: present, peopleOnPhoto: null, subtractedTeacher: false },
      });
    expect((await save(1, [a.id, b.id])).body.lesson).toBe(1);
    expect((await save(2, [a.id])).body.lesson).toBe(2);
    // Исправление второго урока не трогает первый
    await save(2, [b.id]);

    const day = await call('GET', `/api/teacher/groups/${t.group.id}/attendance`, { cookie: t.cookie });
    expect(day.body.lesson).toBe(2); // по умолчанию последний отмеченный
    expect(day.body.lessons).toEqual([
      { lesson: 1, presentCount: 2, studentsTotal: 2, peopleOnPhoto: null },
      { lesson: 2, presentCount: 1, studentsTotal: 2, peopleOnPhoto: null },
    ]);
    const first = await call('GET', `/api/teacher/groups/${t.group.id}/attendance?lesson=1`, { cookie: t.cookie });
    expect(first.body.session.presentStudentIds.sort()).toEqual([a.id, b.id].sort());

    const att = (id: string) => prisma.pointEvent.count({ where: { studentId: id, reasonName: 'Посещение' } });
    expect(await att(a.id)).toBe(1);
    expect(await att(b.id)).toBe(2);

    // На экране урока «сегодня» — последний урок
    const group = await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie });
    expect(group.body.todayAttendance.presentStudentIds).toEqual([b.id]);

    const stats = await call('GET', `/api/teacher/groups/${t.group.id}/stats`, { cookie: t.cookie });
    expect(stats.body.sessions.map((s: any) => s.lesson)).toEqual([1, 2]);
    expect(stats.body.students.find((s: any) => s.id === b.id)).toMatchObject({ attended: 2, sessions: 2 });

    const profile = await call('GET', `/api/teacher/students/${b.id}/profile`, { cookie: t.cookie });
    expect(profile.body.attendance.records.map((r: any) => r.lesson)).toEqual([2, 1]);

    const xlsx = await call('GET', `/api/teacher/groups/${t.group.id}/stats.xlsx`, { cookie: t.cookie });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx.body as ArrayBuffer);
    const head = wb.getWorksheet('Посещаемость')!.getRow(1).values as string[];
    expect(head.filter((v) => typeof v === 'string' && v.includes('урок'))).toHaveLength(2);
  });

  it('удаление отметки урока убирает и баллы за посещение', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const sid = t.students[0].id;
    const date = dateKey(addDays(startOfDay(), -1));
    await call('POST', `/api/teacher/groups/${t.group.id}/attendance`, {
      cookie: t.cookie,
      body: { date, lesson: 2, presentStudentIds: [sid], peopleOnPhoto: 3, subtractedTeacher: true },
    });
    expect(await prisma.pointEvent.count({ where: { studentId: sid } })).toBe(1);
    const del = await call('DELETE', `/api/teacher/groups/${t.group.id}/attendance?date=${date}&lesson=2`, { cookie: t.cookie });
    expect(del.status).toBe(200);
    expect(await prisma.pointEvent.count({ where: { studentId: sid } })).toBe(0);
    expect((await call('DELETE', `/api/teacher/groups/${t.group.id}/attendance?date=${date}&lesson=2`, { cookie: t.cookie })).status).toBe(404);
  });

  it('номер урока проверяется, чужой преподаватель удалить не может', async () => {
    const a = await setupTeacher(['А Один']);
    const b = await setupTeacher([]);
    const bad = await call('POST', `/api/teacher/groups/${a.group.id}/attendance`, {
      cookie: a.cookie,
      body: { lesson: 9, presentStudentIds: [], peopleOnPhoto: null, subtractedTeacher: false },
    });
    expect(bad.status).toBe(400);
    expect((await call('GET', `/api/teacher/groups/${a.group.id}/attendance?lesson=0`, { cookie: a.cookie })).status).toBe(400);
    await call('POST', `/api/teacher/groups/${a.group.id}/attendance`, {
      cookie: a.cookie,
      body: { presentStudentIds: [], peopleOnPhoto: null, subtractedTeacher: false },
    });
    const today = dateKey();
    expect((await call('DELETE', `/api/teacher/groups/${a.group.id}/attendance?date=${today}&lesson=1`, { cookie: b.cookie })).status).toBe(404);
  });
});
