/** Типы ответов API: учётные записи, выданные входы и панель администратора */
import type { Hero } from './profile.js';

export type Role = 'TEACHER' | 'STUDENT' | 'PARENT' | 'ADMIN';

export interface Me {
  login: string;
  role: Role;
  name: string;
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
  premiumUntil: string | null; premiumActive: boolean;
}

export interface AdminTeachers { freeForAll: boolean; teachers: AdminTeacher[] }

export interface AdminGroup {
  id: string; name: string; archivedAt: string | null; studentsCount: number;
  /** Когда удалятся фото и файлы архивной группы */
  filesExpireAt: string | null;
  owner: { id: string; name: string; login: string };
  colleagues: { id: string; name: string }[];
}

/** Школа администратора */
export interface SchoolInfo {
  id: string;
  name: string;
}
