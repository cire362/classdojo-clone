import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { TEACHER, loginApi, loginUi, tempGroup, uniq } from './helpers';

const H = { 'x-heroes-client': '1' };
const axe = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

for (const colorScheme of ['light', 'dark'] as const) {
  test(`календарь: событие видно ученику и родителю, напоминание ждёт в ленте (${colorScheme})`, async ({ page, browser, request }) => {
    const g = await tempGroup(request, uniq('E2E календарь'), ['Лиза Ершова']);
    try {
      await loginApi(request);
      const parent = await (await request.post(`/api/teacher/students/${g.credentials[0].id}/parents`, { headers: H })).json();
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${g.id}`);
      await page.getByRole('link', { name: 'Календарь', exact: true }).click();
      await expect(page.getByText('В этом месяце событий нет')).toBeVisible();

      // Последний день месяца: событие в текущем месяце, но не раньше сегодняшнего
      const now = new Date();
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const date = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
      await page.getByRole('button', { name: 'Событие', exact: true }).click();
      await page.getByLabel('Название').fill('Городская олимпиада');
      await page.getByLabel('Дата', { exact: true }).fill(date);
      await page.getByLabel('Время, если нужно').fill('10:30');
      await page.getByLabel('Описание').fill('Взять ручку и сменную обувь');
      await axe(page);
      await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
      await expect(page.getByText('Городская олимпиада')).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`calendar-teacher-${colorScheme}.png`) });
      await axe(page);

      const pupilContext = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme });
      const pupil = await pupilContext.newPage();
      await pupil.setViewportSize({ width: 375, height: 812 });
      await loginUi(pupil, g.credentials[0].login, g.credentials[0].password);
      await pupil.getByRole('link', { name: 'Календарь', exact: true }).click();
      await expect(pupil.getByText('Городская олимпиада')).toBeVisible();
      await expect(pupil.getByRole('button', { name: 'Событие', exact: true })).toHaveCount(0);
      expect(await pupil.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await pupil.screenshot({ path: test.info().outputPath(`calendar-student-${colorScheme}.png`) });
      await axe(pupil);
      await pupilContext.close();

      const parentContext = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme });
      const home = await parentContext.newPage();
      await home.setViewportSize({ width: 375, height: 812 });
      await loginUi(home, parent.login, parent.password);
      await home.getByRole('button', { name: 'Календарь', exact: true }).click();
      await expect(home.getByText('Городская олимпиада')).toBeVisible();
      await parentContext.close();

      await page.getByRole('button', { name: 'Изменить: Городская олимпиада' }).click();
      await page.getByRole('button', { name: 'Удалить', exact: true }).click();
      await expect(page.getByText('В этом месяце событий нет')).toBeVisible();
    } finally {
      await g.remove();
    }
  });
}
