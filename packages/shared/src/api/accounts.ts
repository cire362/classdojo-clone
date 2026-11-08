/** Типы ответов API: учётные записи, выданные входы и панель администратора */
import type { InstitutionKind } from '../terms.js';
import type { Hero } from './profile.js';

export type Role = 'TEACHER' | 'STUDENT' | 'PARENT' | 'ADMIN' | 'NETWORK';

export interface Me {
  login: string;
  role: Role;
  name: string;
  /** Тип учебного заведения: по нему интерфейс выбирает слова. null — учреждения нет (родитель без детей) */
  institution?: InstitutionKind | null;
  /** Студент: есть ли в его группе герои и награды. У остальных ролей не задано */
  heroes?: boolean;
}

export interface Credentials {
  id: string;
  name: string;
  login: string;
  password: string;
}

/** QR-карточка ученика: токен показывается один раз, при выпуске */
export interface LoginCard {
  studentId: string;
  name: string;
  token: string;
  expiresAt: string;
}

/** Общий код класса */
export interface ClassCode {
  code: string;
  expiresAt: string;
}

/** Список для выбора имени по коду класса */
export interface ClassRoster {
  groupName: string;
  students: { id: string; name: string; hero: Hero }[];
}

/** Родительский вход, привязанный к ученику */
export interface ParentAccess {
  id: string;
  login: string;
  /** Другие дети этого родителя (общий вход для братьев и сестёр) */
  otherChildren: { id: string; name: string }[];
}

export interface ParentCredentials {
  parentId: string;
  studentId: string;
  studentName: string;
  login: string;
  password: string;
}

/** Приглашение родителя при выдаче: код показывается один раз */
export interface ParentInvite {
  id: string;
  studentId: string;
  studentName: string;
  code: string;
  expiresAt: string;
}

/** Действующее приглашение в карточке ученика: кода здесь уже нет */
export interface ActiveInvite {
  id: string;
  expiresAt: string;
}

/** Что родитель видит, открыв приглашение */
export interface InvitePreview {
  studentName: string;
  groupName: string;
}

export interface InviteAccepted {
  user: Me;
  login: string;
}

export interface TeacherCredentials { id: string; name: string; login: string; password: string }

export interface AdminTeacher {
  id: string; name: string; login: string; ownedGroups: number; sharedGroups: number;
  /** Вход отключён администрацией */
  disabled: boolean;
}

export interface AdminTeachers { teachers: AdminTeacher[] }

export interface AdminGroup {
  id: string; name: string; archivedAt: string | null; studentsCount: number;
  /** Подразделение, курс (параллель) и специальность */
  department: { id: string; name: string } | null;
  course: number | null;
  specialty: string;
  /** Когда удалятся фото и файлы архивной группы */
  filesExpireAt: string | null;
  owner: { id: string; name: string; login: string };
  colleagues: { id: string; name: string }[];
}

/** Должность в администрации школы */
export type SchoolRole = 'DIRECTOR' | 'DEPUTY' | 'STAFF';

/** Школа сотрудника администрации и его права в ней */
export interface SchoolInfo {
  id: string;
  name: string;
  kind: InstitutionKind;
  /** Герои и награды в группах учреждения; у групп можно поменять отдельно */
  heroes: boolean;
  role: SchoolRole;
  /** Код подключения преподавателей; null — выключен или не виден этой должности */
  joinCode: string | null;
  /** Заявок преподавателей ждут проверки; сотруднику без прав на них — 0 */
  pendingTeachers: number;
  /** Подразделение смотрящего: он видит только его группы. null — всё учреждение */
  department: { id: string; name: string } | null;
}

/** Подразделение колледжа или вуза; кафедра лежит внутри факультета */
export interface Department {
  id: string;
  name: string;
  parentId: string | null;
  groups: number;
  admins: number;
}

/** Сотрудник администрации школы */
export interface StaffMember {
  id: string;
  name: string;
  login: string;
  role: SchoolRole;
  /** Подразделение сотрудника; null — всё учреждение */
  departmentId: string | null;
  /** Это сам смотрящий: себя изменить и удалить нельзя */
  isMe: boolean;
}

/** Преподаватель подключился по коду школы и ждёт проверки */
export interface TeacherRequest {
  id: string;
  name: string;
  login: string;
  createdAt: string;
}

/** Что видит преподаватель, введя код школы */
export interface SchoolJoinPreview {
  schoolName: string;
  kind: InstitutionKind;
}
