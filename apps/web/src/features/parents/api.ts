import { api, type InviteAccepted, type InvitePreview, type ParentChild, type Profile } from '../../lib/api';

export const fetchChildren = () => api<ParentChild[]>('GET', '/parent/children');

export const fetchChildProfile = (childId: string) => api<Profile>('GET', `/parent/children/${childId}/profile`);

export const previewInvite = (code: string) => api<InvitePreview>('POST', '/auth/invite', { code });

export const acceptInvite = (code: string, password: string) => api<InviteAccepted>('POST', '/auth/invite/accept', { code, password });

export const addChildByInvite = (code: string) => api<InvitePreview>('POST', '/parent/invite', { code });
