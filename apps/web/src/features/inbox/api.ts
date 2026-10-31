import { api, type StudentNotifications } from '../../lib/api';

export const fetchNotifications = (query?: string) =>
  api<StudentNotifications>('GET', query ? `/student/notifications?${query}` : '/student/notifications');

export const markNotificationsRead = (groupId: string, through: string) => api('POST', '/student/notifications/read', { groupId, through });
