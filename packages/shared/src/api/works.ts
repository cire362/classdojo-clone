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

/** Адресат работы: дисциплина и её преподаватель или, без дисциплины, куратор группы */
export interface WorkAddress {
  /** null — куратору группы */
  subject: string | null;
  /** null — дисциплину из группы убрали */
  teacher: string | null;
}

/** Кому студент может отправить работу: куратору или преподавателю дисциплины группы */
export interface WorkRecipients {
  /** Создатель группы: классный руководитель в школе, куратор в колледже и вузе */
  curator: string;
  subjects: { id: string; name: string; teacher: string }[];
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
