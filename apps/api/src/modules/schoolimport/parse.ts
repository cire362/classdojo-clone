import { HttpError } from '../../platform/errors.js';

/**
 * Разбор таблицы учреждения: одна строка — один ученик (или группа без учеников).
 * Столбцы ищутся по заголовку в первых строках, порядок любой.
 */
export interface ImportRow {
  line: number;
  department: string;
  group: string;
  course: number | null;
  specialty: string;
  teacher: string;
  teacherLogin: string;
  student: string;
}

const COLUMNS = {
  group: /^(группа|класс|группа или класс)$/i,
  department: /^(подразделение|факультет|отделение|кафедра)$/i,
  course: /^(курс|параллель)$/i,
  specialty: /^(специальность|направление|специальность или направление)$/i,
  teacher: /^(преподаватель|учитель|классный руководитель|куратор)$/i,
  teacherLogin: /^логин (преподавателя|учителя)$/i,
  student: /^(ученик|студент|учащийся|обучающийся|фио|ф\.и\.о\.?)$/i,
} as const;

type Column = keyof typeof COLUMNS;

export const MAX_IMPORT_ROWS = 5000;

export function parseInstitution(rows: string[][]): ImportRow[] {
  const headerAt = rows.slice(0, 10).findIndex((r) => r.some((c) => COLUMNS.group.test(c)));
  if (headerAt < 0) throw new HttpError(422, 'Не нашли заголовок «Группа» или «Класс». Скачайте образец и заполните его');
  const header = rows[headerAt];
  const index = Object.fromEntries(
    (Object.keys(COLUMNS) as Column[]).map((key) => [key, header.findIndex((c) => COLUMNS[key].test(c.trim()))]),
  ) as Record<Column, number>;
  const cell = (r: string[], key: Column) => (index[key] >= 0 ? (r[index[key]] ?? '').replace(/\s+/g, ' ').trim() : '');
  const data = rows.slice(headerAt + 1);
  if (data.length > MAX_IMPORT_ROWS) throw new HttpError(422, `В файле больше ${MAX_IMPORT_ROWS} строк`);
  return data
    .map((r, i) => {
      const course = Number.parseInt(cell(r, 'course'), 10);
      return {
        line: headerAt + i + 2,
        department: cell(r, 'department').slice(0, 120),
        group: cell(r, 'group').slice(0, 60),
        course: Number.isInteger(course) && course >= 1 && course <= 11 ? course : null,
        specialty: cell(r, 'specialty').slice(0, 120),
        teacher: cell(r, 'teacher').slice(0, 80),
        teacherLogin: cell(r, 'teacherLogin').toLowerCase(),
        student: cell(r, 'student').slice(0, 80),
      };
    })
    .filter((r) => r.group || r.student);
}
