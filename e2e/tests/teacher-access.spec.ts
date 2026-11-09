import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { animationsDone, loginUi } from './helpers';

const ADMIN = { login: process.env.E2E_ADMIN_LOGIN ?? 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'admin12345' };
const H = { 'x-heroes-client': '1' };

test('директор отключает вход преподавателя и удаляет его учётную запись', async ({ page, playwright, baseURL }) => {
  const login = `e2e.leaving.${Date.now().toString(36)}`;
  const admin = await playwright.request.newContext({ baseURL, extraHTTPHeaders: H });
  await admin.post('/api/auth/login', { data: ADMIN });
  const created = await (await admin.post('/api/admin/teachers', { data: { name: 'E2E Уходящий', login } })).json();
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginUi(page, ADMIN.login, ADMIN.password);
    await page.getByRole('button', { name: 'Доступ и группы: E2E Уходящий' }).click();
    const dialog = page.getByRole('dialog', { name: 'Доступ: E2E Уходящий' });
    await dialog.getByRole('button', { name: 'Отключить вход' }).click();
    await expect(dialog.getByRole('button', { name: 'Включить вход' })).toBeVisible();
    await animationsDone(page);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);

    const teacher = await playwright.request.newContext({ baseURL, extraHTTPHeaders: H });
    const denied = await teacher.post('/api/auth/login', { data: { login, password: created.password } });
    expect(denied.status()).toBe(403);
    await teacher.dispose();

    await dialog.getByLabel('Удалить безвозвратно').check();
    await dialog.getByRole('button', { name: 'Удалить преподавателя' }).click();
    await expect(page.getByText('Преподаватель удалён')).toBeVisible();
    await expect(page.getByRole('heading', { name: /E2E Уходящий/ })).toHaveCount(0);
  } finally {
    await admin.delete(`/api/admin/teachers/${created.id}`);
    await admin.dispose();
  }
});
