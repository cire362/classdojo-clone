import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import type { InstitutionKind, SchoolRole } from '../src/generated/prisma/client';
import { hashPassword } from '../src/platform/credentials.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

async function setupInstitution(kind: InstitutionKind, name: string) {
  const school = await prisma.school.create({ data: { name, kind } });
  const staff = async (role: SchoolRole) => {
    const loginName = `staff.${randomUUID().slice(0, 8)}`;
    await prisma.admin.create({
      data: {
        name: 'Ирина Львовна', role, school: { connect: { id: school.id } },
        account: { create: { login: loginName, role: 'ADMIN', passwordHash: await hashPassword('staff-test-123') } },
      },
    });
    return login(loginName, 'staff-test-123');
  };
  return { school, director: await staff('DIRECTOR'), staff };
}

const me = async (cookie: string) => (await call('GET', '/api/auth/me', { cookie })).body.user;

it('тип учреждения виден всем его ролям во входе: администрации, преподавателю, студенту и родителю', async () => {
  const uni = await setupInstitution('UNIVERSITY', 'Политех');
  const t = await setupTeacher(['Маша Иванова'], uni.school.id);
  const issued = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  for (const cookie of [uni.director, t.cookie, await t.studentCookie(0), await login(issued.login, issued.password)]) {
    expect((await me(cookie)).institution).toBe('UNIVERSITY');
  }
  const account = await prisma.account.findFirstOrThrow({ where: { teacher: { id: t.teacher.id } } });
  const signedIn = await call('POST', '/api/auth/login', { body: { login: account.login, password: 'teacher-pass-123' } });
  expect(signedIn.body.user.institution).toBe('UNIVERSITY');
  // Старые учётки остаются в школе
  expect((await me((await setupTeacher(['Петя Смирнов'])).cookie)).institution).toBe('SCHOOL');
});

it('руководитель меняет тип учреждения; заместитель и сотрудник — нет; неизвестный тип не проходит', async () => {
  const s = await setupInstitution('SCHOOL', 'Северная школа');
  expect((await call('GET', '/api/admin/school', { cookie: s.director })).body.kind).toBe('SCHOOL');
  const changed = await call('PATCH', '/api/admin/school', { cookie: s.director, body: { kind: 'COLLEGE' } });
  expect(changed.body).toMatchObject({ name: 'Северная школа', kind: 'COLLEGE' });
  expect((await call('PATCH', '/api/admin/school', { cookie: await s.staff('DEPUTY'), body: { kind: 'SCHOOL' } })).status).toBe(403);
  expect((await call('PATCH', '/api/admin/school', { cookie: s.director, body: { kind: 'KINDERGARTEN' } })).status).toBe(400);
  expect((await call('PATCH', '/api/admin/school', { cookie: s.director, body: {} })).status).toBe(400);
  expect((await call('PATCH', '/api/admin/school', { cookie: s.director, body: { name: 'Колледж связи' } })).body).toMatchObject({
    name: 'Колледж связи', kind: 'COLLEGE',
  });
});

it('код подключения показывает тип, ответ в ящике подписан администрацией учреждения его типа', async () => {
  const college = await setupInstitution('COLLEGE', 'Колледж связи');
  const { joinCode } = (await call('POST', '/api/admin/join-code', { cookie: college.director })).body;
  const preview = (await call('POST', '/api/auth/school-join/preview', { body: { code: joinCode } })).body;
  expect(preview).toEqual({ schoolName: 'Колледж связи', kind: 'COLLEGE' });

  const t = await setupTeacher(['Маша Иванова'], college.school.id);
  const issued = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  const parent = await login(issued.login, issued.password);
  await call('POST', `/api/parent/school-messages/${college.school.id}`, { cookie: parent, body: { text: 'Вопрос' } });
  const [row] = (await call('GET', '/api/admin/inbox', { cookie: college.director })).body;
  const reply = (await call('POST', `/api/admin/inbox/${row.id}`, { cookie: college.director, body: { text: 'Ответ' } })).body;
  expect(reply.messages[1].author).toBe('Ирина Львовна, администрация колледжа');
});

it('в вузе ответы API, Excel и архив говорят «студент», а в школе — «ученик»', async () => {
  const { default: ExcelJS } = await import('exceljs');
  const { unzipSync, strFromU8 } = await import('fflate');
  const uni = await setupInstitution('UNIVERSITY', 'Политех');
  const t = await setupTeacher(['Маша Иванова'], uni.school.id);
  const school = await setupTeacher(['Петя Смирнов']);
  const reason = (await call('GET', `/api/teacher/groups/${t.group.id}/reasons`, { cookie: t.cookie })).body[0].id;
  const foreign = { reasonId: reason, studentIds: [school.students[0].id] };
  const res = await call('POST', `/api/teacher/groups/${t.group.id}/points`, { cookie: t.cookie, body: foreign });
  expect(res).toMatchObject({ status: 404, body: { error: 'Студент не найден в группе' } });
  expect((await call('GET', `/api/teacher/students/${school.students[0].id}/profile`, { cookie: school.cookie })).status).toBe(200);
  const schoolError = await call('GET', `/api/teacher/students/${t.students[0].id}/profile`, { cookie: school.cookie });
  expect(schoolError.body.error).toBe('Ученик не найден');

  const xlsx = await call('GET', `/api/teacher/groups/${t.group.id}/stats.xlsx`, { cookie: t.cookie });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsx.body as ArrayBuffer);
  const headers = wb.worksheets.flatMap((ws) => [1, 2, 3, 4].flatMap((n) => ws.getRow(n).values as unknown[]));
  expect(headers).toContain('Студент');
  expect(headers).not.toContain('Ученик');

  const zip = await call('GET', `/api/teacher/groups/${t.group.id}/export`, { cookie: t.cookie });
  const files = Object.entries(unzipSync(new Uint8Array(zip.body as ArrayBuffer)));
  const readme = strFromU8(files.find(([name]) => name.endsWith('.txt'))![1]);
  expect(readme).toContain('Студенты — вложения переписки');
});
