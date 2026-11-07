import { api, type ChatMessage, type InboxThread, type InboxThreadDetail, type ParentSchoolThread } from '../../lib/api';
import { messageBody, type Outgoing } from '../messages';

/** Родитель и студент пишут из своих кабинетов: адрес зависит от роли */
type Reader = 'parent' | 'student';

export const fetchReaderThreads = (who: Reader) => api<ParentSchoolThread[]>('GET', `/${who}/school-messages`);

export const writeToSchool = (who: Reader, schoolId: string, message: Outgoing) =>
  api<ChatMessage[]>('POST', `/${who}/school-messages/${schoolId}`, messageBody(message));

export const fetchInbox = () => api<InboxThread[]>('GET', '/admin/inbox');

export const fetchInboxThread = (id: string) => api<InboxThreadDetail>('GET', `/admin/inbox/${id}`);

export const replyFromSchool = (id: string, message: Outgoing) =>
  api<InboxThreadDetail>('POST', `/admin/inbox/${id}`, messageBody(message));

export const markHandled = (id: string) => api<InboxThreadDetail>('POST', `/admin/inbox/${id}/handled`);
