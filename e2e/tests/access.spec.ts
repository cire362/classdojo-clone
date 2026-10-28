import { expect, test } from '@playwright/test';
import { loginUi, tempGroup, uniq } from './helpers';

test.describe('права доступа', () => {
  test('без входа: страницы ведут на вход, API закрыт', async ({ page, request }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    expect((await request.get('/api/teacher/groups')).status()).toBe(401);
    expect((await request.get('/api/student/profile')).status()).toBe(401);
  });

  test('ученик не попадает в разделы и API преподавателя', async ({ page, request, browser }) => {
    const g = await tempGroup(request, uniq('E2E доступ'), ['Ученик Проверочный']);
    try {
      const s = g.credentials[0];
      await loginUi(page, s.login, s.password);
      await expect(page.getByRole('link', { name: 'Собрать героя' })).toBeVisible();
      // Прямой переход на страницы преподавателя возвращает в кабинет
      for (const path of [`/g/${g.id}`, `/g/${g.id}/stats`, '/settings', `/s/${s.id}`]) {
        await page.goto(path);
        await expect(page.getByRole('link', { name: 'Собрать героя' }), path).toBeVisible();
      }
      // И на уровне API — 403, а не только скрытые кнопки
      const api = page.context().request;
      expect((await api.get('/api/teacher/groups')).status()).toBe(403);
      expect((await api.get(`/api/teacher/groups/${g.id}/stats`)).status()).toBe(403);
      const award = await api.post(`/api/teacher/groups/${g.id}/points`, {
        data: { studentIds: [s.id], reasonId: 'x' },
        headers: { 'x-heroes-client': '1' },
      });
      expect(award.status()).toBe(403);
      void browser;
    } finally {
      await g.remove();
    }
  });
});
