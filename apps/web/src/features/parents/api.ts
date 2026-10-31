import { api, type ParentChild, type Profile } from '../../lib/api';

export const fetchChildren = () => api<ParentChild[]>('GET', '/parent/children');

export const fetchChildProfile = (childId: string) => api<Profile>('GET', `/parent/children/${childId}/profile`);
