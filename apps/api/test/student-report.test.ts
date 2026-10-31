import { expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { studentReport } from '../src/modules/reports/index.js';
import { reportPdf } from '../src/modules/reports/index.js';
import { call, login, setupTeacher } from './helpers.js';

it('PDF доступен владельцу и соавтору, чужим и другим ролям закрыт; архив читается', async () => {
  const t = await setupTeacher(['Алёна Иванова']);
  const other = await setupTeacher(['Другой ученик']);
  const sid = t.students[0].id;
  const path = `/api/teacher/students/${sid}/report.pdf?from=2026-01-01&to=2026-01-31`;
  expect((await call('GET', path)).status).toBe(401);
  expect((await call('GET', path, { cookie: other.cookie })).status).toBe(404);
  expect((await call('GET', path, { cookie: await t.studentCookie(0) })).status).toBe(403);
  const parent = (await call('POST', `/api/teacher/students/${sid}/parents`, { cookie: t.cookie })).body;
  expect((await call('GET', path, { cookie: await login(parent.login, parent.password) })).status).toBe(403);
  await prisma.group.update({ where: { id: t.group.id }, data: { archivedAt: new Date(), coTeachers: { create: { teacherId: other.teacher.id } } } });
  for (const cookie of [t.cookie, other.cookie]) {
    const res = await call('GET', path, { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toContain("filename*=UTF-8''");
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(Buffer.from(res.body).subarray(0, 5).toString()).toBe('%PDF-');
    expect(Buffer.from(res.body).toString('latin1')).toContain('/ToUnicode');
    expect(Buffer.from(res.body).toString('latin1')).toContain('/FontFile2');
  }
});

it('полная история, точные границы по Москве, снимки причин и исправления', async () => {
  const t = await setupTeacher(['Алёна Иванова']);
  const studentId = t.students[0].id;
  await prisma.pointEvent.createMany({ data: Array.from({ length: 305 }, () => ({ studentId, reasonName: 'Помощь', emoji: '⭐', value: 1, createdAt: new Date('2025-12-31T21:00:00Z') })) });
  const mistake = await prisma.pointEvent.create({ data: { studentId, reasonName: 'Помощь', emoji: '⭐', value: -2, createdAt: new Date('2026-01-31T20:59:59.999Z') } });
  await prisma.pointEvent.create({ data: { studentId, reasonName: 'За границей', emoji: '⭐', value: 99, createdAt: new Date('2026-01-31T21:00:00Z') } });
  await prisma.pointEvent.create({ data: { studentId, reasonName: 'До границы', emoji: '⭐', value: 99, createdAt: new Date('2025-12-31T20:59:59.999Z') } });
  let report = await studentReport(studentId, t.teacher.id, { from: '2026-01-01', to: '2026-01-31' });
  expect(report.points).toEqual({ earned: 305, lost: 2, net: 303 });
  expect(report.reasons).toEqual([{ name: 'Помощь', count: 306, earned: 305, lost: 2 }]);
  expect(report).not.toHaveProperty('login');
  expect(report).not.toHaveProperty('password');
  await prisma.pointEvent.delete({ where: { id: mistake.id } });
  report = await studentReport(studentId, t.teacher.id, { from: '2026-01-01', to: '2026-01-31' });
  expect(report.points.net).toBe(305);
});

it('отметки берутся по дате урока, без выдуманных пропусков, с историей после перевода', async () => {
  const t = await setupTeacher(['Алёна Иванова', 'Другой ученик']);
  const [student, other] = t.students;
  const add = (lessonNumber: number, studentId: string, present: boolean) => prisma.attendanceSession.create({ data: { groupId: t.group.id, date: new Date('2026-01-02'), lessonNumber, studentsTotal: 1, records: { create: { studentId, present } } } });
  await add(1, student.id, true);
  const absent = await add(2, student.id, false);
  await add(3, other.id, false);
  const target = await prisma.group.create({ data: { name: 'Новая группа', teacherId: t.teacher.id } });
  await prisma.student.update({ where: { id: student.id }, data: { groupId: target.id } });
  let report = await studentReport(student.id, t.teacher.id, { from: '2026-01-01', to: '2026-01-31' });
  expect(report.groupName).toBe('Новая группа');
  expect(report.attendance).toMatchObject({ total: 2, attended: 1, missed: 1 });
  expect(report.attendance.records.map((r) => r.groupName)).toEqual(['Тестовая группа', 'Тестовая группа']);
  await prisma.attendance.update({ where: { sessionId_studentId: { sessionId: absent.id, studentId: student.id } }, data: { present: true } });
  report = await studentReport(student.id, t.teacher.id, { from: '2026-01-01', to: '2026-01-31' });
  expect(report.attendance.missed).toBe(0);
});

it('пустой отчёт формируется, неверные даты и слишком длинный период дают понятную ошибку', async () => {
  const t = await setupTeacher(['Алёна Иванова']);
  const path = `/api/teacher/students/${t.students[0].id}/report.pdf`;
  const report = await studentReport(t.students[0].id, t.teacher.id, { from: '2026-01-01', to: '2026-01-01' });
  expect(report.points).toEqual({ earned: 0, lost: 0, net: 0 });
  expect(report.attendance.total).toBe(0);
  for (const suffix of ['?from=2026-02-30&to=2026-03-01', '?from=2026-01-02&to=2026-01-01', '?from=2025-01-01&to=2026-01-31', '?from=9999-01-01&to=9999-01-02']) expect((await call('GET', path + suffix, { cookie: t.cookie })).status).toBe(400);
});

it('длинные названия и много уроков создают несколько страниц со встроенными шрифтами', async () => {
  const t = await setupTeacher(['Алёна Иванова']);
  const report = await studentReport(t.students[0].id, t.teacher.id, { from: '2026-01-01', to: '2026-01-31' });
  report.studentName = 'Алёна Евдокия Константинопольская-Рождественская';
  report.reasons = [{ name: 'Сложная причина с символами 🎉 и Ё, длинным названием и латиницей English', count: 305, earned: 305, lost: 0 }];
  report.attendance.records = Array.from({ length: 60 }, (_, i) => ({ date: '2026-01-02', lesson: i + 1, present: true, groupName: 'Группа с длинным названием для проверки переноса строк и полей' }));
  const bytes = await reportPdf(report);
  const raw = bytes.toString('latin1');
  expect((raw.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
  expect(raw).toContain('/FontFile2');
  expect(bytes.length).toBeLessThan(1_000_000);
});
