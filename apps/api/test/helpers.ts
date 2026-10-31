import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { prisma } from '../src/platform/db.js';
import { hashPassword } from '../src/platform/credentials.js';
import { createDefaultReasons } from '../src/modules/reasons/index.js';
import { createDefaultRewards } from '../src/modules/rewards/index.js';
import { syncHeroParts } from '../src/modules/hero/index.js';
import { createStudents } from '../src/modules/students/index.js';

export const app = createApp();

export interface Res<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export async function call<T = any>(
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string>; noClientHeader?: boolean } = {},
): Promise<Res<T>> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (!opts.noClientHeader) headers['x-heroes-client'] = '1';
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const res = await app.request(path, {
    method,
    headers,
    body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  const ct = res.headers.get('content-type') ?? '';
  const body = ct.includes('json') ? await res.json() : await res.arrayBuffer();
  return { status: res.status, body: body as T, headers: res.headers };
}

export async function login(loginName: string, password: string): Promise<string> {
  const res = await call('POST', '/api/auth/login', { body: { login: loginName, password } });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  const setCookie = res.headers.get('set-cookie')!;
  return setCookie.split(';')[0];
}

/** Преподаватель с группой и учениками; возвращает cookie для входа */
export async function setupTeacher(studentNames = ['Маша Иванова', 'Петя Смирнов', 'Оля Котова']) {
  await syncHeroParts();
  const loginName = `t${randomUUID().slice(0, 8)}`;
  const password = 'teacher-pass-123';
  const teacher = await prisma.teacher.create({
    data: {
      name: 'Тестовый учитель',
      account: { create: { login: loginName, passwordHash: await hashPassword(password), role: 'TEACHER' } },
    },
  });
  const group = await prisma.group.create({ data: { name: 'Тестовая группа', teacherId: teacher.id } });
  await createDefaultReasons(prisma, group.id);
  await createDefaultRewards(prisma, group.id);
  const students = await createStudents(group.id, studentNames);
  const cookie = await login(loginName, password);
  const reasons = await prisma.behaviorReason.findMany({ where: { groupId: group.id }, orderBy: { sortOrder: 'asc' } });
  return {
    teacher,
    group,
    students,
    cookie,
    plusReason: reasons.find((r) => r.kind === 'MANUAL' && r.value === 1)!,
    plus2Reason: reasons.find((r) => r.kind === 'MANUAL' && r.value === 2)!,
    minusReason: reasons.find((r) => r.kind === 'MANUAL' && r.value < 0)!,
    studentCookie: (i: number) => login(students[i].login, students[i].password),
  };
}
