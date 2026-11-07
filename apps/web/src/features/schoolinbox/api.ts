import { api, type ChatMessage, type InboxThread, type InboxThreadDetail, type ParentSchoolThread } from '../../lib/api';
import { messageBody, type Outgoing } from '../messages';

export const fetchParentSchoolThreads = () => api<ParentSchoolThread[]>('GET', '/parent/school-messages');

export const writeToSchool = (schoolId: string, message: Outgoing) =>
  api<ChatMessage[]>('POST', `/parent/school-messages/${schoolId}`, messageBody(message));

export const fetchInbox = () => api<InboxThread[]>('GET', '/admin/inbox');

export const fetchInboxThread = (id: string) => api<InboxThreadDetail>('GET', `/admin/inbox/${id}`);

export const replyFromSchool = (id: string, message: Outgoing) =>
  api<InboxThreadDetail>('POST', `/admin/inbox/${id}`, messageBody(message));

export const markHandled = (id: string) => api<InboxThreadDetail>('POST', `/admin/inbox/${id}/handled`);
