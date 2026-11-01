import { api, type ClassEvent } from '../../lib/api';

export type EventData = Omit<ClassEvent, 'id'>;

/** Адрес календаря свой у каждой роли, поэтому его передаёт страница */
export const fetchEvents = (path: string, month: string) => api<ClassEvent[]>('GET', `${path}?month=${month}`);

export const createEvent = (path: string, data: EventData) => api<ClassEvent>('POST', path, data);

export const updateEvent = (path: string, id: string, data: EventData) => api<ClassEvent>('PUT', `${path}/${id}`, data);

export const deleteEvent = (path: string, id: string) => api('DELETE', `${path}/${id}`);
