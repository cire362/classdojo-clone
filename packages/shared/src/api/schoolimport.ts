/** Типы ответов API: импорт учреждения одним файлом */
import type { TeacherCredentials } from './accounts.js';

export interface ImportPlanGroup {
  name: string;
  /** Группа уже есть: в неё добавятся только новые ученики */
  exists: boolean;
  department: string;
  course: number | null;
  specialty: string;
  teacher: { name: string; login: string; exists: boolean };
  /** Сколько учеников уже в группе */
  students: number;
  newStudents: string[];
}

export interface ImportPlan {
  departments: string[];
  teachers: { name: string; login: string }[];
  groups: ImportPlanGroup[];
  /** Строка 0 — ошибка не в одной строке, а во всём файле */
  errors: { line: number; message: string }[];
}

export interface ImportResult {
  teachers: TeacherCredentials[];
  groups: number;
  students: number;
}
