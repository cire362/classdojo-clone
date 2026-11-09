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
  /** Кому отправлена; null — ответ на задание или работа в портфолио у родителей */
  to: WorkAddress | null;
}

/** Адресат работы: преподаватель группы и, если выбрана, его дисциплина */
export interface WorkAddress {
  /** null — преподавателя удалили */
  teacherId: string | null;
  teacher: string | null;
  subject: string | null;
  /** Адресат — куратор группы (в школе — классный руководитель), её создатель */
  curator: boolean;
}

/** Кому студент может отправить работу: первым идёт куратор, затем дисциплины и остальные преподаватели группы */
export interface WorkRecipient {
  teacherId: string;
  teacher: string;
  subjectId: string | null;
  subject: string | null;
  curator: boolean;
}

/** Работа в очереди преподавателя: с именем ученика */
export interface GroupWork extends StudentWork {
  student: { id: string; name: string };
  /** Работа адресована тому, кто смотрит очередь */
  mine: boolean;
}

export interface GroupWorks {
  pending: GroupWork[];
  /** Последние решённые, новые сверху */
  decided: GroupWork[];
}
