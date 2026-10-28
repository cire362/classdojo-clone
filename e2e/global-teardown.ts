import { request } from '@playwright/test';
import { TEACHER } from './tests/helpers';

/**
 * Страховка: если тест упал по таймауту и не успел убрать за собой, удаляем все
 * временные группы с префиксом «E2E» (так их называют только сквозные тесты).
 */
export default async function globalTeardown() {
  const ctx = await request.newContext({ baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080' });
  const headers = { 'x-heroes-client': '1' };
  try {
    const login = await ctx.post('/api/auth/login', { data: TEACHER, headers });
    if (!login.ok()) return;
    const groups = (await (await ctx.get('/api/teacher/groups')).json()) as { id: string; name: string }[];
    for (const g of groups.filter((g) => g.name.startsWith('E2E '))) {
      await ctx.delete(`/api/teacher/groups/${g.id}`, { headers });
    }
  } finally {
    await ctx.dispose();
  }
}
