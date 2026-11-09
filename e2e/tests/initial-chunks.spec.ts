import { expect, test } from '@playwright/test';
import { TEACHER } from './helpers';

test('вход не загружает дополнительные иконки, разделы получают их после входа', async ({ page }) => {
  const extraRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/assets\/icons-extra-[^/]+\.js/.test(request.url())) extraRequests.push(request.url());
  });
  // Даже недоступность кода иконок других разделов не должна ломать первый экран.
  await page.route('**/assets/icons-extra-*.js', (route) => route.abort());
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(extraRequests).toEqual([]);

  await page.unroute('**/assets/icons-extra-*.js');
  await page.getByLabel('Логин', { exact: true }).fill(TEACHER.login);
  await page.getByLabel('Пароль', { exact: true }).fill(TEACHER.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
  expect(extraRequests.length).toBeGreaterThan(0);
  await expect(page.getByText('Не удалось загрузить страницу')).toHaveCount(0);
});
