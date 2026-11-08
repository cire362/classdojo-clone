/** Типы ответов API: переход учреждения на новый учебный год */

export interface SchoolYearGroup {
  id: string;
  name: string;
  course: number;
  students: number;
  /** Название после перехода, если в нём записан номер курса */
  nextName: string;
  /** Предлагается выпустить: курс последний для учреждения */
  graduate: boolean;
}

export interface SchoolYearPreview {
  lastStartedAt: string | null;
  /** Переход был недавно: повтор нужно подтвердить */
  recent: boolean;
  maxCourse: number;
  groups: SchoolYearGroup[];
  withoutCourse: { id: string; name: string }[];
}

export interface SchoolYearResult {
  promoted: number;
  graduated: number;
  renamed: number;
}
