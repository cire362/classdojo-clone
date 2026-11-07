import { api, type AdminSchoolPost, type SchoolPost } from '../../lib/api';

export const fetchSchoolFeed = () => api<SchoolPost[]>('GET', '/school-feed');

export const fetchAdminSchoolFeed = () => api<AdminSchoolPost[]>('GET', '/admin/school-feed');

/** Форма: text, important, file (несколько) */
export const createSchoolPost = (form: FormData) => api<AdminSchoolPost[]>('POST', '/admin/school-feed', form);

export const deleteSchoolPost = (id: string) => api<AdminSchoolPost[]>('DELETE', `/admin/school-feed/${id}`);
