import { api, type Hero, type Profile } from '../../lib/api';

export interface PartAccess {
  id: string;
  requiredLevel: number;
  isPremium: boolean;
}

export const fetchPartAccess = () => api<PartAccess[]>('GET', '/hero-parts');

export const fetchStudentProfile = () => api<Profile>('GET', '/student/profile');

export const saveStudentHero = (name: string, parts: Record<string, string>) => api<Hero>('PUT', '/student/hero', { name, parts });
