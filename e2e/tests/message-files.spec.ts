import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { IMAGES, TEACHER, loginApi, loginUi, tempGroup, uniq } from './helpers';

const H = { 'x-heroes-client': '1' };
const PHOTO = { name: 'crew_4_people.jpg', mimeType: 'image/jpeg', buffer: readFileSync(`${IMAGES}crew_4_people.jpg`) };
const PDF = { name: 'справка.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% справка от врача\n%%EOF\n') };
const axe = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};
const loaded = (image: Locator) =>
  expect.poll(() => image.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);

for (const colorScheme of ['light', 'dark'] as const) {
  test(`вложения в сообщениях: фото и PDF от родителя у преподавателя (${colorScheme})`, async ({ page, browser, request }) => {
    const g = await tempGroup(request, uniq('E2E вложения'), ['Лиза Ершова']);
    try {
      await loginApi(request);
      const parent = await (await request.post(`/api/teacher/students/${g.credentials[0].id}/parents`, { headers: H })).json();

      const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme, reducedMotion: 'reduce' });
      const home = await context.newPage();
      await home.setViewportSize({ width: 375, height: 812 });
      await loginUi(home, parent.login, parent.password);
      await home.getByRole('button', { name: /Сообщения/ }).click();
      await home.locator('input[type=file]').setInputFiles([PHOTO, PDF]);
      await expect(home.getByRole('list', { name: 'Выбранные файлы' }).getByRole('listitem')).toHaveCount(2);
      await home.getByLabel('Сообщение', { exact: true }).fill('Справка и фото с олимпиады');
      await axe(home);
      await home.getByRole('button', { name: 'Отправить', exact: true }).click();
      const mine = home.getByRole('listitem').filter({ hasText: 'Справка и фото с олимпиады' });
      await loaded(mine.getByRole('img', { name: 'Фото 1: crew_4_people.jpg' }));
      await expect(mine.getByRole('link', { name: /справка\.pdf/ })).toBeVisible();
      expect(await home.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await home.screenshot({ path: test.info().outputPath(`message-files-parent-${colorScheme}.png`) });
      await axe(home);
      await context.close();

      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/messages/${g.credentials[0].id}/${parent.parentId}`);
      const message = page.getByRole('listitem').filter({ hasText: 'Справка и фото с олимпиады' });
      await loaded(message.getByRole('img', { name: 'Фото 1: crew_4_people.jpg' }));
      const download = page.waitForEvent('download');
      await message.getByRole('link', { name: /справка\.pdf/ }).click();
      const file = await download;
      expect(file.suggestedFilename()).toBe('справка.pdf');
      const bytes = await (await request.get(new URL(file.url()).pathname, { headers: H })).body();
      expect(bytes.equals(PDF.buffer)).toBe(true);
      await axe(page);
    } finally {
      await g.remove();
    }
  });
}
