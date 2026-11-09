import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { animationsDone, IMAGES, loginApi, loginUi, TEACHER, tempGroup, uniq } from './helpers';

const H = { 'x-heroes-client': '1' };
const PHOTO = { name: 'поделка.jpg', mimeType: 'image/jpeg', buffer: readFileSync(`${IMAGES}crew_4_people.jpg`) };
const axe = async (page: Page) => {
  await animationsDone(page);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};
const loaded = (image: Locator) =>
  expect.poll(() => image.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);

for (const colorScheme of ['light', 'dark'] as const) {
  test(`работы: ученик сдаёт, преподаватель публикует, родитель видит в портфолио (${colorScheme})`, async ({ page, browser, request }) => {
    const g = await tempGroup(request, uniq('E2E работы'), ['Лиза Ершова']);
    try {
      await loginApi(request);
      const parent = await (await request.post(`/api/teacher/students/${g.credentials[0].id}/parents`, { headers: H })).json();
      const options = { baseURL: test.info().project.use.baseURL, colorScheme, reducedMotion: 'reduce' as const };

      const pupilContext = await browser.newContext(options);
      const pupil = await pupilContext.newPage();
      await pupil.setViewportSize({ width: 375, height: 812 });
      await loginUi(pupil, g.credentials[0].login, g.credentials[0].password);
      await pupil.getByRole('link', { name: 'Мои работы' }).click();
      await pupil.getByLabel('Название').fill('Поделка из бумаги');
      await pupil.getByLabel('Текст, если нужен').fill('Склеила ракету');
      await pupil.locator('input[type=file]').setInputFiles([PHOTO]);
      await axe(pupil);
      // Без предметов в классе работа уходит классному руководителю — форма называет его
      await expect(pupil.getByText(/^Кому: Классный руководитель — .+/)).toBeVisible();
      await pupil.getByRole('button', { name: 'Отправить', exact: true }).click();
      const mine = pupil.getByRole('list', { name: 'Мои работы' }).getByRole('listitem').filter({ hasText: 'Поделка из бумаги' });
      await expect(mine.getByText('На проверке')).toBeVisible();
      await expect(mine).toContainText(/Кому: Классный руководитель — /);
      await loaded(mine.getByRole('img', { name: /поделка\.jpg/ }));
      expect(await pupil.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await axe(pupil);

      // До одобрения родитель работу не видит
      const parentContext = await browser.newContext(options);
      const home = await parentContext.newPage();
      await loginUi(home, parent.login, parent.password);
      await home.getByRole('tab', { name: /Портфолио/ }).click();
      await expect(home.getByText('Здесь появятся работы ученика, когда преподаватель их опубликует.')).toBeVisible();

      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${g.id}/stats`);
      await page.getByRole('link', { name: /Работы.*1 работа ждёт проверки/ }).click();
      await expect(page.getByRole('heading', { name: 'На проверке: 1' })).toBeVisible();
      await page.getByLabel('Комментарий ученику').fill('Очень аккуратно!');
      await axe(page);
      await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'На проверке: 0' })).toBeVisible();
      await expect(page.getByRole('link', { name: /ждёт проверки/ })).toHaveCount(0);
      await page.screenshot({ path: test.info().outputPath(`works-teacher-${colorScheme}.png`) });

      await home.reload();
      await home.getByRole('tab', { name: /Портфолио/ }).click();
      const published = home.getByRole('region', { name: 'Работы' });
      await expect(published.getByRole('heading', { name: 'Поделка из бумаги' })).toBeVisible();
      await expect(published.getByText('Очень аккуратно!')).toBeVisible();
      await loaded(published.getByRole('img', { name: /поделка\.jpg/ }));
      await axe(home);
      await parentContext.close();

      await pupil.reload();
      await expect(mine.getByText('Опубликована')).toBeVisible();
      await pupilContext.close();
    } finally {
      await g.remove();
    }
  });
}
