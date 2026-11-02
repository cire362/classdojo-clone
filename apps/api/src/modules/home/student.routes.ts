import { Hono } from 'hono';
import type { AppEnv } from '../../platform/auth.js';
import { homeBoard } from './service.js';

/** Свои домашние баллы, только просмотр. Роль проверяет routes/student.ts */
export const studentHomeRoutes = new Hono<AppEnv>().get('/home', async (c) => c.json(await homeBoard(c.get('user').studentId!)));
