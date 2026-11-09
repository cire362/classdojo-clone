import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { animationsDone, IMAGES, loginUi, TEACHER } from './helpers';

const ADMIN = { login: process.env.E2E_ADMIN_LOGIN ?? 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'admin12345' };
const PARENT = { login: process.env.E2E_PARENT_LOGIN ?? 'parent', password: process.env.E2E_PARENT_PASSWORD ?? 'parent12345' };
const PHOTO = { name: 'праздник.jpg', mimeType: 'image/jpeg', buffer: readFileSync(`${IMAGES}crew_4_people.jpg`) };
const axe = async (page: Page) => {
  await animationsDone(page);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

for (const colorScheme of ['light', 'dark'] as const) {
  test(`лента школы: объявление директора читают семья и преподаватель (${colorScheme})`, async ({ page, browser }) => {
    const text = `E2E собрание ${colorScheme} ${Date.now().toString(36)}`;
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await loginUi(page, ADMIN.login, ADMIN.password);
    await page.getByRole('button', { name: 'Лента школы', exact: true }).click();
    await page.getByLabel('Новая запись').fill(text);
    await page.locator('input[type=file]').setInputFiles([PHOTO]);
    await page.getByLabel(/Объявление для всех семей/).check();
    await axe(page);
    await page.getByRole('button', { name: 'Опубликовать' }).click();
    await expect(page.getByText('Объявление отправлено всем семьям')).toBeVisible();
    const post = page.getByRole('article').filter({ hasText: text });
    const before = Number((await post.getByText(/^Прочитали \d+ из \d+/).innerText()).match(/\d+/)![0]);

    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme, reducedMotion: 'reduce' });
    try {
      const parent = await context.newPage();
      await parent.setViewportSize({ width: 375, height: 812 });
      await loginUi(parent, PARENT.login, PARENT.password);
      await parent.getByRole('link', { name: /Новости школы.*новых записей/ }).click();
      const seen = parent.getByRole('article').filter({ hasText: text });
      await expect(seen.getByText('Объявление')).toBeVisible();
      await expect(seen.getByText('Новое')).toBeVisible();
      await expect(seen.getByRole('img', { name: /праздник/ })).toBeVisible();
      await axe(parent);
      expect(await parent.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await parent.screenshot({ path: test.info().outputPath(`school-feed-parent-${colorScheme}.png`), fullPage: true });
      await expect(parent.getByRole('link', { name: /Новости школы.*новых записей/ })).toHaveCount(0);

      const teacher = await context.newPage();
      await context.clearCookies();
      await loginUi(teacher, TEACHER.login, TEACHER.password);
      await teacher.getByRole('link', { name: /Новости школы/ }).click();
      await expect(teacher.getByRole('article').filter({ hasText: text })).toBeVisible();

      await page.reload();
      await page.getByRole('button', { name: 'Лента школы', exact: true }).click();
      await expect(post.getByText(`Прочитали ${before + 1} из`)).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`school-feed-admin-${colorScheme}.png`), fullPage: true });
    } finally {
      await context.close();
      // Запись удаляется: стенд общий для всех тестов
      await page.getByRole('article').filter({ hasText: text }).getByRole('button', { name: 'Удалить' }).click();
      await page.getByRole('button', { name: 'Удалить запись' }).click();
      await expect(page.getByRole('article').filter({ hasText: text })).toHaveCount(0);
    }
  });
}
