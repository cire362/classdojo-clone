/** Типы ответов API: работы учеников */
import type { FileInfo } from './files.js';

export type WorkStatus = 'PENDING' | 'APPROVED' | 'RETURNED';

/** Работа ученика. Без одобрения её видят только сам ученик и преподаватели группы */
export interface StudentWork {
  id: string;
  title: string;
  text: string;
  status: WorkStatus;
  /** Слова преподавателя: что доделать или похвала */
  comment: string;
  createdAt: string;
  decidedAt: string | null;
  /** Кто решил: имя преподавателя */
  decidedBy: string | null;
  /** Фото и PDF: GET /api/files/:id, превью фото — ?size=preview */
  files: FileInfo[];
  /** Решение новое: ученик его ещё не видел */
  unseen: boolean;
}

/** Работа в очереди преподавателя: с именем ученика */
export interface GroupWork extends StudentWork {
  student: { id: string; name: string };
}

export interface GroupWorks {
  pending: GroupWork[];
  /** Последние решённые, новые сверху */
  decided: GroupWork[];
}
