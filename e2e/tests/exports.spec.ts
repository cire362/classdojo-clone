import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Download, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { animationsDone, IMAGES, loginApi, loginUi, TEACHER, tempGroup, uniq } from './helpers';

const H = { 'x-heroes-client': '1' };
const PHOTO = { name: 'crew.jpg', mimeType: 'image/jpeg', buffer: readFileSync(`${IMAGES}crew_4_people.jpg`) };
const axe = async (page: Page) => {
  await animationsDone(page);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};
/** Имена файлов внутри скачанного архива */
const contents = async (download: Download) => Object.keys(unzipSync(readFileSync(await download.path()))).sort();

for (const colorScheme of ['light', 'dark'] as const) {
  test(`экспорт файлов: архив родителя и архивной группы со сроком хранения (${colorScheme})`, async ({ page, browser, request }) => {
    const g = await tempGroup(request, uniq('E2E экспорт'), ['Лиза Ершова']);
    try {
      await loginApi(request);
      const parent = await (await request.post(`/api/teacher/students/${g.credentials[0].id}/parents`, { headers: H })).json();
      await request.post(`/api/teacher/groups/${g.id}/feed`, { headers: H, multipart: { text: 'Экскурсия', photo: PHOTO } });

      const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme, reducedMotion: 'reduce' });
      const home = await context.newPage();
      await home.setViewportSize({ width: 375, height: 812 });
      await loginUi(home, parent.login, parent.password);
      await home.getByRole('button', { name: /Лента класса/ }).click();
      await expect(home.getByText('Экскурсия')).toBeVisible();
      await axe(home);
      const parentDownload = home.waitForEvent('download');
      await home.getByRole('link', { name: 'Скачать фото и файлы' }).click();
      const parentZip = await parentDownload;
      expect(parentZip.suggestedFilename()).toMatch(/^Герои класса — Лиза Ершова — \d{4}-\d{2}-\d{2}\.zip$/);
      expect(await contents(parentZip)).toEqual([expect.stringMatching(/^Лента класса\/\d{4}-\d{2}-\d{2} Экскурсия\/01\.jpg$/), 'Что в архиве.txt']);
      await context.close();

      await request.post(`/api/teacher/groups/${g.id}/archive`, { headers: H });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${g.id}/feed`);
      await expect(page.getByText(/Фото и файлы группы удалятся \d+ \S+ \d{4}/)).toBeVisible();
      await page.setViewportSize({ width: 375, height: 812 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await page.screenshot({ path: test.info().outputPath(`archived-group-files-${colorScheme}.png`) });
      await axe(page);
      const groupDownload = page.waitForEvent('download');
      await page.getByRole('link', { name: 'Скачать архив' }).click();
      expect(await contents(await groupDownload)).toEqual([expect.stringMatching(/^Лента\/.* Экскурсия\/01\.jpg$/), 'Что в архиве.txt']);
    } finally {
      await g.remove();
    }
  });
}
