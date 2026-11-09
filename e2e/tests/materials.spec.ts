import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { animationsDone, loginUi, TEACHER, uniq } from './helpers';

const DOCX = new URL('../fixtures/metodichka.docx', import.meta.url).pathname;

test('методичка Word: загрузка, просмотр без скачивания через PDF и удаление', async ({ page }) => {
  const title = uniq('E2E Методичка');
  await page.setViewportSize({ width: 375, height: 812 });
  await loginUi(page, TEACHER.login, TEACHER.password);
  await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
  await page.getByRole('link', { name: 'Открыть методички' }).click();
  await page.getByLabel('Файл до 25 МБ').setInputFiles(DOCX);
  await page.getByLabel('Название').fill(title);
  await page.getByRole('button', { name: 'Добавить' }).click();
  await expect(page.getByText('Методичка добавлена')).toBeVisible({ timeout: 60_000 });
  await animationsDone(page);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);

  await page.getByRole('link', { name: `Смотреть: ${title}` }).click();
  const frame = page.getByTitle(`Просмотр: ${title}`);
  await expect(frame).toBeVisible();
  // Документ Word отдаётся на просмотр PDF-копией, которую сделал сервис просмотра
  const src = await frame.getAttribute('src');
  const view = await page.request.get(src!);
  expect(view.headers()['content-type']).toBe('application/pdf');
  expect(view.headers()['content-disposition']).toMatch(/^inline;/);
  expect((await view.body()).subarray(0, 5).toString()).toBe('%PDF-');

  await page.getByRole('link', { name: 'Все методички' }).click();
  await page.getByRole('button', { name: `Удалить: ${title}` }).click();
  await expect(page.getByRole('link', { name: title })).toHaveCount(0);
});
