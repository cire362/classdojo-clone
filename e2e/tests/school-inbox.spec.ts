import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { animationsDone, IMAGES, loginUi } from './helpers';

const ADMIN = { login: process.env.E2E_ADMIN_LOGIN ?? 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'admin12345' };
const PARENT = { login: process.env.E2E_PARENT_LOGIN ?? 'parent', password: process.env.E2E_PARENT_PASSWORD ?? 'parent12345' };
const PHOTO = { name: 'справка.jpg', mimeType: 'image/jpeg', buffer: readFileSync(`${IMAGES}crew_4_people.jpg`) };
const axe = async (page: Page) => {
  await animationsDone(page);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

for (const colorScheme of ['light', 'dark'] as const) {
  test(`ящик школы: родитель пишет со справкой, администрация отвечает (${colorScheme})`, async ({ page, browser }) => {
    const question = `E2E вопрос ${colorScheme} ${Date.now().toString(36)}`;
    const answer = `E2E ответ ${colorScheme}`;
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme, reducedMotion: 'reduce' });
    try {
      const parent = await context.newPage();
      await parent.setViewportSize({ width: 375, height: 812 });
      await loginUi(parent, PARENT.login, PARENT.password);
      await parent.getByRole('link', { name: 'Письмо в школу' }).click();
      await expect(parent.getByRole('heading', { name: 'Письмо в школу', level: 1 })).toBeVisible();
      const box = parent.getByRole('region').first();
      await box.getByLabel('Сообщение').fill(question);
      await box.locator('input[type=file]').setInputFiles([PHOTO]);
      await axe(parent);
      await box.getByRole('button', { name: 'Отправить' }).click();
      await expect(box.getByText(question)).toBeVisible();
      await expect(box.getByRole('img', { name: /справка/ }).last()).toBeVisible();
      expect(await parent.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);

      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, ADMIN.login, ADMIN.password);
      await page.getByRole('button', { name: /Ящик школы.*ждут ответа/ }).click();
      const row = page.getByRole('list', { name: 'Переписки с семьями' }).getByRole('button').filter({ hasText: question });
      await expect(row.getByText('Ждёт ответа')).toBeVisible();
      await axe(page);
      await row.click();
      await expect(page.getByRole('img', { name: /справка/ }).last()).toBeVisible();
      await page.getByLabel('Сообщение').fill(answer);
      await page.getByRole('button', { name: 'Отправить' }).click();
      await expect(page.getByRole('button', { name: /Решено без ответа/ })).toHaveCount(0);
      await axe(page);
      await page.screenshot({ path: test.info().outputPath(`school-inbox-admin-${colorScheme}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Все переписки' }).click();
      await expect(page.getByRole('list', { name: 'Переписки с семьями' }).getByRole('button').filter({ hasText: answer })).toBeVisible();

      await parent.goto('/');
      await parent.getByRole('link', { name: /Письмо в школу.*новых ответов/ }).click();
      await expect(parent.getByText(answer)).toBeVisible();
      await expect(parent.getByText(/администрация школы/).last()).toBeVisible();
      await parent.screenshot({ path: test.info().outputPath(`school-inbox-parent-${colorScheme}.png`), fullPage: true });
      await expect(parent.getByRole('link', { name: /новых ответов/ })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}
