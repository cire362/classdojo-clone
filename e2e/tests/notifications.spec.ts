import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginApi, tempGroup, uniq } from './helpers';

const headers = { 'x-heroes-client': '1' };

for (const colorScheme of ['light', 'dark'] as const) {
  test(`уведомления ученика: обновление, выдача награды и прочтение (${colorScheme})`, async ({ page, request }) => {
    const g = await tempGroup(request, uniq('E2E уведомления'), ['Лиза Ершова']);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      const reason = await (await request.post(`/api/teacher/groups/${g.id}/reasons`, { data: { name: 'Проект', value: 10, emoji: '⭐' }, headers })).json();
      for (let i = 0; i < 2; i++) expect((await request.post(`/api/teacher/groups/${g.id}/points`, { data: { reasonId: reason.id, studentIds: [g.credentials[0].id] }, headers })).ok()).toBeTruthy();
      await loginApi(page.request, g.credentials[0].login, g.credentials[0].password);
      const shop = await (await page.request.get('/api/student/shop')).json();
      const reward = shop.rewards.find((r: { cost: number }) => r.cost === 15);
      expect((await page.request.post(`/api/student/shop/${reward.id}/request`, { headers })).ok()).toBeTruthy();
      await page.goto('/notifications');
      await expect(page.getByRole('heading', { name: 'Пока тихо' })).toBeVisible();

      expect((await request.post(`/api/teacher/groups/${g.id}/feed`, { data: { text: 'В пятницу встречаемся в планетарии. Не забудьте тетради для наблюдений.' }, headers })).ok()).toBeTruthy();
      const pending = await (await request.get(`/api/teacher/groups/${g.id}/rewards`)).json();
      expect((await request.post(`/api/teacher/reward-requests/${pending.requests[0].id}/approve`, { headers })).ok()).toBeTruthy();
      // Как при возвращении на вкладку: счётчики и открытая коллекция обновляются вместе.
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      const bell = page.getByRole('link', { name: /^Уведомления/ });
      await expect(bell).toContainText('2');
      await expect(page.getByRole('heading', { name: 'Награда выдана' })).toBeVisible();
      await expect(page.getByText('Новое', { exact: true })).toHaveCount(2);
      await expect(page.getByRole('status')).toContainText('2 непрочитанных уведомления');
      for (const width of [1280, 375]) {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
        expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
        await page.screenshot({ path: test.info().outputPath(`notifications-${width}-${colorScheme}.png`), fullPage: true });
      }

      await page.getByRole('link', { name: 'К наградам', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Награды', exact: true })).toBeVisible();
      await expect(bell).toContainText('1');
      await bell.click();
      await expect(page.getByRole('status')).toContainText('1 непрочитанное уведомление');
      await expect(page.getByText('Новое', { exact: true })).toHaveCount(1);
      await page.getByRole('button', { name: 'Прочитать все' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Всё прочитано' })).toBeVisible();
      await expect(page.getByText('Новое', { exact: true })).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole('button', { name: 'Прочитать все' })).toBeDisabled();

      await request.post(`/api/teacher/groups/${g.id}/feed`, { data: { text: 'Сбор у входа в 10:00.' }, headers });
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      const latest = page.getByRole('listitem').filter({ hasText: 'Сбор у входа в 10:00.' });
      await expect(latest.getByText('Новое', { exact: true })).toBeVisible();
      await latest.getByRole('link', { name: 'В ленту класса' }).click();
      // Сначала дождаться ленты: тот же текст виден и в уведомлениях, пока страница не сменилась
      await expect(page.getByRole('heading', { name: 'Лента класса', level: 1 })).toBeVisible();
      await expect(page.getByText('Сбор у входа в 10:00.', { exact: true })).toBeVisible();
      await bell.click();
      await expect(page.getByRole('button', { name: 'Прочитать все' })).toBeDisabled();
    } finally {
      await g.remove();
    }
  });
}
