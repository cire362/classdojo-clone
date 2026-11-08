import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import ExcelJS from 'exceljs';
import { requireRole, requireSchoolRole, type AppEnv } from '../../platform/auth.js';
import { HttpError } from '../../platform/errors.js';
import { terms } from '../../platform/terms.js';
import { MAX_IMPORT_BYTES, readTable } from '../students/index.js';
import { parseInstitution } from './parse.js';
import { applyPlan, buildPlan } from './service.js';

const MANAGERS = requireSchoolRole('DIRECTOR', 'DEPUTY');
const limit = bodyLimit({
  maxSize: MAX_IMPORT_BYTES + 64 * 1024,
  onError: () => {
    throw new HttpError(413, 'Файл слишком большой (больше 2 МБ)');
  },
});

async function planFrom(c: Context<AppEnv>) {
  const file = (await c.req.parseBody())['file'];
  if (!(file instanceof File)) throw new HttpError(400, 'Загрузите файл');
  const { rows } = await readTable(file);
  return buildPlan(c.get('user').schoolId!, parseInstitution(rows));
}

/** Образец с заголовками на языке учреждения: «Класс» в школе, «Группа» в колледже и вузе */
async function template() {
  const words = terms();
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Учреждение');
  const school = words.kind === 'SCHOOL';
  sheet.columns = [
    { header: 'Подразделение', width: 24 },
    { header: school ? 'Класс' : 'Группа', width: 16 },
    { header: words.course, width: 10 },
    { header: 'Специальность', width: 28 },
    { header: school ? 'Учитель' : 'Преподаватель', width: 26 },
    { header: school ? 'Логин учителя' : 'Логин преподавателя', width: 22 },
    { header: 'ФИО', width: 28 },
  ];
  sheet.getRow(1).font = { bold: true };
  const example = school
    ? [['', '5 «А»', 5, '', 'Анна Сергеевна Петрова', '', 'Маша Иванова'], ['', '5 «А»', 5, '', '', '', 'Петя Смирнов']]
    : [['Факультет ИТ', 'ИВТ-21', 2, 'Информатика', 'Игорь Павлович Ершов', '', 'Лиза Ершова']];
  example.forEach((r) => sheet.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Импорт учреждения одним файлом: проводят руководитель и заместитель всего учреждения */
export const adminSchoolImportRoutes = new Hono<AppEnv>()
  .use(requireRole('ADMIN'))
  .get('/school-import/template.xlsx', MANAGERS, async () =>
    new Response(new Uint8Array(await template()), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="import.xlsx"; filename*=UTF-8''${encodeURIComponent('Образец импорта.xlsx')}`,
        'Cache-Control': 'no-store',
      },
    }))
  .post('/school-import/preview', MANAGERS, limit, async (c) => c.json(await planFrom(c)))
  .post('/school-import', MANAGERS, limit, async (c) => c.json(await applyPlan(c.get('user').schoolId!, await planFrom(c)), 201));
