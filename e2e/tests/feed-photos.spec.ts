import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { animationsDone, IMAGES, loginUi, TEACHER, tempGroup, uniq } from './helpers';

const axe = async (page: Page) => {
  await animationsDone(page);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};
/** Картинка действительно загрузилась, а не показала пустое место */
const loaded = (image: Locator) => expect.poll(() => image.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);

for (const colorScheme of ['light', 'dark'] as const) {
  test(`фото в ленте: напоминание о запрете, публикация, просмотр учеником (${colorScheme})`, async ({ page, browser, request }) => {
    const g = await tempGroup(request, uniq('E2E фото'), ['Лиза Ершова', 'Гоша Фотов']);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${g.id}/students`);
      await page.getByRole('button', { name: 'Изменить: Гоша Фотов' }).click();
      await page.getByText('Не публиковать фото', { exact: true }).click();
      await axe(page);
      await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
      await expect(page.getByLabel('Фото не публикуются')).toBeVisible();

      await page.getByRole('link', { name: 'Лента', exact: true }).click();
      await page.getByLabel('Объявление для учеников и родителей').fill('Экскурсия на завод');
      await page.locator('input[type=file]').setInputFiles([`${IMAGES}crew_4_people.jpg`, `${IMAGES}crew_7_people.jpg`]);
      await expect(page.getByText('Проверьте снимки и видео. Нельзя публиковать: Гоша Фотов.')).toBeVisible();
      await expect(page.getByRole('list', { name: 'Выбранные фото и видео' }).getByRole('img', { name: /^Фото \d/ })).toHaveCount(2);
      await axe(page);
      await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
      const post = page.getByRole('listitem').filter({ hasText: 'Экскурсия на завод' });
      await expect(post.getByRole('button', { name: 'Открыть фото 2 из 2' })).toBeVisible();
      await expect(page.getByRole('list', { name: 'Выбранные фото и видео' })).toHaveCount(0);
      for (const img of await post.getByRole('list', { name: 'Фото' }).locator('img').all()) await loaded(img);
      await page.screenshot({ path: test.info().outputPath(`feed-photos-teacher-${colorScheme}.png`) });
      await axe(page);

      const pupilContext = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme });
      const pupil = await pupilContext.newPage();
      await pupil.setViewportSize({ width: 375, height: 812 });
      await loginUi(pupil, g.credentials[0].login, g.credentials[0].password);
      // В имени ссылки ещё и счётчик новых записей
      await pupil.getByRole('link', { name: /^Лента/ }).click();
      const seen = pupil.getByRole('listitem').filter({ hasText: 'Экскурсия на завод' });
      await seen.getByRole('button', { name: 'Открыть фото 1 из 2' }).click();
      const full = pupil.getByRole('img', { name: 'Фото 1 из 2' });
      await loaded(full);
      // Снимок пересобран сервером: не больше 2048 точек по большей стороне
      expect(await full.evaluate((i: HTMLImageElement) => Math.max(i.naturalWidth, i.naturalHeight))).toBeLessThanOrEqual(2048);
      await pupil.getByRole('button', { name: /Дальше/ }).click();
      await loaded(pupil.getByRole('img', { name: 'Фото 2 из 2' }));
      expect(await pupil.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await pupil.screenshot({ path: test.info().outputPath(`feed-photos-student-${colorScheme}.png`) });
      await axe(pupil);
      await pupilContext.close();

      await post.getByRole('button', { name: 'Удалить запись' }).click();
      await expect(post).toHaveCount(0);
    } finally {
      await g.remove();
    }
  });
}

test('видео в ленте: без метаданных, отдаётся частями, ученик видит плеер', async ({ page, browser, request }) => {
  const g = await tempGroup(request, uniq('E2E видео'), ['Вика Видео']);
  const VIDEO = new URL('../../apps/api/test/fixtures/geo.mov', import.meta.url).pathname;
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await loginUi(page, TEACHER.login, TEACHER.password);
    await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    await page.goto(`/g/${g.id}/feed`);
    await page.getByLabel('Объявление для учеников и родителей').fill('Выступление на празднике');
    await page.locator('input[type=file]').setInputFiles([VIDEO, `${IMAGES}crew_4_people.jpg`]);
    await expect(page.getByRole('img', { name: 'Видео: geo.mov' })).toBeVisible();
    await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
    const post = page.getByRole('listitem').filter({ hasText: 'Выступление на празднике' });
    const player = post.locator('video');
    await expect(player).toHaveAttribute('controls', '');
    await expect(post.getByRole('button', { name: 'Открыть фото 1 из 1' })).toBeVisible();
    await axe(page);

    // Метаданные съёмки удалены сервером; перемотка получает часть файла
    const src = (await player.getAttribute('src'))!;
    const whole = await page.request.get(src);
    const text = Buffer.from(await whole.body()).toString('latin1');
    for (const secret of ['55.7539', 'SECRET-PHONE', '2026-11-01']) expect(text).not.toContain(secret);
    const part = await page.request.get(src, { headers: { range: 'bytes=0-99' } });
    expect(part.status()).toBe(206);
    expect((await part.body()).length).toBe(100);

    const pupilContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const pupil = await pupilContext.newPage();
    await pupil.setViewportSize({ width: 375, height: 812 });
    await loginUi(pupil, g.credentials[0].login, g.credentials[0].password);
    await pupil.getByRole('link', { name: /^Лента/ }).click();
    await expect(pupil.getByRole('listitem').filter({ hasText: 'Выступление на празднике' }).locator('video')).toHaveAttribute('src', src);
    expect(await pupil.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
    await axe(pupil);
    await pupilContext.close();
  } finally {
    await g.remove();
  }
});
