import { api, type ClassCode, type ClassRoster, type LoginCard, type Me } from '../../lib/api';

export const issueLoginCards = (groupId: string, studentIds?: string[]) =>
  api<{ cards: LoginCard[] }>('POST', `/teacher/groups/${groupId}/login-cards`, { studentIds });

export const fetchClassCode = (groupId: string) => api<ClassCode | null>('GET', `/teacher/groups/${groupId}/class-code`);

export const createClassCode = (groupId: string) => api<ClassCode>('POST', `/teacher/groups/${groupId}/class-code`);

export const removeClassCode = (groupId: string) => api('DELETE', `/teacher/groups/${groupId}/class-code`);

export const loginByCard = (token: string) => api<{ user: Me }>('POST', '/auth/qr', { token });

export const fetchRoster = (code: string) => api<ClassRoster>('POST', '/auth/class-code', { code });

export const loginByClassCode = (code: string, studentId: string) =>
  api<{ user: Me }>('POST', '/auth/class-code/login', { code, studentId });
