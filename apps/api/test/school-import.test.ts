import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { expect, it } from 'vitest';
import { hashPassword } from '../src/platform/credentials.js';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

async function staff(schoolId: string, role: 'DIRECTOR' | 'STAFF') {
  const loginName = `adm.${randomUUID().slice(0, 8)}`;
  await prisma.admin.create({
    data: {
      name: role, role, school: { connect: { id: schoolId } },
      account: { create: { login: loginName, role: 'ADMIN', passwordHash: await hashPassword('admin-test-123') } },
    },
  });
  return login(loginName, 'admin-test-123');
}

const upload = (cookie: string, path: string, data: string, name = 'school.csv') => {
  const form = new FormData();
  form.append('file', new File([data], name));
  return call('POST', `/api/admin/${path}`, { cookie, raw: form });
};

const CSV = [
  'Подразделение;Группа;Курс;Специальность;Преподаватель;ФИО',
  'Факультет ИТ;ИВТ-21;2;Информатика;Игорь Павлович Ершов;Лиза Ершова',
  'Факультет ИТ;ИВТ-21;2;Информатика;;Глеб Орлов',
  ';ИВТ-21;;;;Лиза Ершова',
  'Экономический;Эк-11;1;Экономика;Тестовый учитель;Вера Лосева',
  ';Существующая;;;;Новенький Студент',
  ';Существующая;;;;Маша Иванова',
].join('\n');

it('импорт вуза из файла: план без изменений, затем подразделения, группы, преподаватели и студенты', async () => {
  const school = await prisma.school.create({ data: { name: 'Политех', kind: 'UNIVERSITY' } });
  const existing = await setupTeacher(['Маша Иванова'], school.id);
  await prisma.group.update({ where: { id: existing.group.id }, data: { name: 'Существующая' } });
  const director = await staff(school.id, 'DIRECTOR');
  const clerk = await staff(school.id, 'STAFF');
  expect((await upload(clerk, 'school-import/preview', CSV)).status).toBe(403);

  const plan = (await upload(director, 'school-import/preview', CSV)).body;
  expect(plan.errors).toEqual([]);
  expect(plan.departments).toEqual(['Факультет ИТ', 'Экономический']);
  expect(plan.teachers).toEqual([{ name: 'Игорь Павлович Ершов', login: expect.stringMatching(/^igor\.p\d*$/) }]);
  const byName = Object.fromEntries(plan.groups.map((g: { name: string }) => [g.name, g]));
  expect(byName['ИВТ-21']).toMatchObject({ exists: false, course: 2, newStudents: ['Лиза Ершова', 'Глеб Орлов'] });
  // Существующий преподаватель находится по имени, существующий студент не дублируется
  expect(byName['Эк-11'].teacher).toMatchObject({ name: 'Тестовый учитель', exists: true });
  expect(byName['Существующая']).toMatchObject({ exists: true, students: 1, newStudents: ['Новенький Студент'] });
  expect(await prisma.department.count({ where: { schoolId: school.id } })).toBe(0);

  const done = await upload(director, 'school-import', CSV);
  expect(done.status).toBe(201);
  expect(done.body).toMatchObject({ groups: 2, students: 4 });
  expect(done.body.teachers).toMatchObject([{ name: 'Игорь Павлович Ершов', login: plan.teachers[0].login }]);
  const ivt = await prisma.group.findFirstOrThrow({
    where: { name: 'ИВТ-21', teacher: { schoolId: school.id } },
    include: { department: true, teacher: true, _count: { select: { students: true, reasons: true } } },
  });
  expect(ivt).toMatchObject({ course: 2, specialty: 'Информатика', department: { name: 'Факультет ИТ' } });
  expect(ivt.teacher.name).toBe('Игорь Павлович Ершов');
  expect(ivt._count.students).toBe(2);
  expect(ivt._count.reasons).toBeGreaterThan(0);
  expect(await prisma.student.count({ where: { groupId: existing.group.id } })).toBe(2);
  // Новый преподаватель входит с выданным паролем
  expect((await login(plan.teachers[0].login, done.body.teachers[0].password)).length).toBeGreaterThan(0);

  // Повторный импорт того же файла ничего не дублирует
  const again = (await upload(director, 'school-import/preview', CSV)).body;
  expect(again.departments).toEqual([]);
  expect(again.groups.every((g: { exists: boolean; newStudents: string[] }) => g.exists && g.newStudents.length === 0)).toBe(true);
});

it('ошибки файла видны в плане, и импорт с ними не проходит; образец скачивается словами учреждения', async () => {
  const school = await prisma.school.create({ data: { name: 'Школа 3', kind: 'SCHOOL' } });
  const director = await staff(school.id, 'DIRECTOR');
  const bad = ['Класс;ФИО', '5 «А»;Маша Иванова', ';Петя Смирнов'].join('\n');
  const plan = (await upload(director, 'school-import/preview', bad)).body;
  expect(plan.errors.map((e: { message: string }) => e.message)).toEqual([
    'Не указана группа',
    'У новой группы «5 «А»» не указан преподаватель',
  ]);
  expect((await upload(director, 'school-import', bad)).status).toBe(422);
  expect((await upload(director, 'school-import/preview', 'просто текст')).status).toBe(422);

  const template = await call('GET', '/api/admin/school-import/template.xlsx', { cookie: director });
  expect(template.status).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(template.body as ArrayBuffer);
  expect(wb.worksheets[0].getRow(1).values).toContain('Класс');
  expect(wb.worksheets[0].getRow(1).values).toContain('Параллель');
});
