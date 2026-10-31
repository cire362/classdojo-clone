import { describe, expect, it } from 'vitest';
import { call, login, setupTeacher } from './helpers.js';

/** Маршруты, вынесенные из routes/teacher.ts в модули, остаются закрыты проверкой роли */
const routes = (groupId: string, studentId: string): [string, string][] => [
  ['GET', `/api/teacher/groups/${groupId}/goal`],
  ['DELETE', `/api/teacher/groups/${groupId}/goal`],
  ['POST', `/api/teacher/groups/${groupId}/teams`],
  ['PUT', `/api/teacher/groups/${groupId}/teams/assign`],
  ['GET', `/api/teacher/groups/${groupId}/feed`],
  ['DELETE', '/api/teacher/posts/any'],
];

describe('маршруты модулей преподавателя', () => {
  it('без входа 401, для ученика и родителя 403', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const student = await t.studentCookie(0);
    const parent = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
    const parentCookie = await login(parent.login, parent.password);
    for (const [method, path] of routes(t.group.id, t.students[0].id)) {
      expect((await call(method, path)).status, `${method} ${path}`).toBe(401);
      expect((await call(method, path, { cookie: student })).status, `${method} ${path}`).toBe(403);
      expect((await call(method, path, { cookie: parentCookie })).status, `${method} ${path}`).toBe(403);
    }
  });
});
