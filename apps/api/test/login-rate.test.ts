import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { checkLoginRate, cleanupLoginAttempts, resetLoginRate } from '../src/platform/auth.js';
import { prisma } from '../src/platform/db.js';
import { createApp } from '../src/app.js';
import { HttpError } from '../src/platform/errors.js';
import { setupTeacher } from './helpers.js';

describe('ограничение попыток входа в общей базе', () => {
  it('после лимита — 429 с Retry-After, сброс после успешного входа', async () => {
    const key = `1.2.3.4|${randomUUID()}`;
    for (let i = 0; i < 3; i++) await checkLoginRate(key, 3);
    const err = await checkLoginRate(key, 3).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(429);
    expect(Number(err.headers['Retry-After'])).toBeGreaterThan(14 * 60);
    expect(err.message).toMatch(/через 15 мин/);
    await resetLoginRate(key);
    await expect(checkLoginRate(key, 3)).resolves.toBeUndefined();
  });

  it('в базе не хранятся IP и логин, окно истекает', async () => {
    const key = `10.0.0.1|login-${randomUUID()}`;
    await checkLoginRate(key, 3);
    const rows = await prisma.loginAttempt.findMany();
    expect(rows.some((r) => r.key.includes('10.0.0.1') || r.key.includes('login-'))).toBe(false);
    // Переводим окно в прошлое — счётчик начинается заново, старые записи подчищаются
    await prisma.loginAttempt.updateMany({ data: { resetAt: new Date(Date.now() - 1000) } });
    for (let i = 0; i < 3; i++) await checkLoginRate(key, 3);
    await prisma.loginAttempt.updateMany({ data: { resetAt: new Date(Date.now() - 1000) } });
    await cleanupLoginAttempts();
    expect(await prisma.loginAttempt.count()).toBe(0);
  });

  it('счётчик общий для разных копий API и выдерживает одновременные запросы', async () => {
    const key = `5.6.7.8|${randomUUID()}`;
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => checkLoginRate(key, 5)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(3);

    // Две независимые копии приложения видят одни и те же попытки
    const t = await setupTeacher(['Ученик Один']);
    const login = t.students[0].login;
    const appA = createApp();
    const appB = createApp();
    const tryLogin = (app: ReturnType<typeof createApp>) =>
      app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-heroes-client': '1', 'x-real-ip': '9.9.9.9' },
        body: JSON.stringify({ login, password: 'wrong' }),
      });
    // В тестах лимит 1000 (vitest.config) — проверяем, что обе копии наращивают один счётчик
    await tryLogin(appA);
    await tryLogin(appB);
    const row = await prisma.loginAttempt.findFirst({ orderBy: { count: 'desc' }, where: { count: 2 } });
    expect(row?.count).toBe(2);
  });
});
