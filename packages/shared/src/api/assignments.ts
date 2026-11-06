/** Типы ответов API: задания группе и ответы учеников */
import type { FileInfo } from './files.js';
import type { StudentWork, WorkStatus } from './works.js';

/** NONE — ответа нет; иначе состояние последнего ответа */
export type AnswerStatus = 'NONE' | WorkStatus;

export interface Assignment {
  id: string;
  title: string;
  description: string;
  /** Сдать до этого дня включительно, YYYY-MM-DD */
  dueOn: string | null;
  /** Баллы за принятый ответ */
  points: number;
  createdAt: string;
  author: string | null;
  /** Фото и PDF к заданию: GET /api/files/:id */
  files: FileInfo[];
}

/** Задание в списке преподавателя: сколько ответов в каком состоянии */
export interface TeacherAssignment extends Assignment {
  assigned: number;
  pending: number;
  accepted: number;
  returned: number;
}

export interface AssignmentAnswer {
  student: { id: string; name: string };
  status: AnswerStatus;
  /** Последний ответ ученика */
  work: StudentWork | null;
  /** Ответ сдан позже срока */
  late: boolean;
}

export interface AssignmentDetail extends TeacherAssignment {
  answers: AssignmentAnswer[];
}

/** Задание глазами ученика */
export interface StudentAssignment extends Assignment {
  status: AnswerStatus;
  /** Ученик ещё не видел задание */
  isNew: boolean;
  /** Срок прошёл, а ответ не сдан или возвращён */
  overdue: boolean;
  /** Ответы ученика, новые сверху */
  works: StudentWork[];
}

/**
 * Задание глазами родителя: состояние и решение преподавателя. Содержимое ответа — только принятого:
 * до проверки ответ видят лишь ученик и преподаватели, как и работы
 */
export interface ParentAssignment extends Assignment {
  status: AnswerStatus;
  overdue: boolean;
  /** Комментарий преподавателя к последнему решению */
  comment: string;
  accepted: StudentWork | null;
}
