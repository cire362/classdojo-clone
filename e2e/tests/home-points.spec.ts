import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loginApi, loginUi, tempGroup, uniq } from './helpers';

const axe = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};
const narrow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);

for (const colorScheme of ['light', 'dark'] as const) {
  test(`домашние баллы: родитель ведёт цель, ученик видит, школьный счёт не меняется (${colorScheme})`, async ({ page, browser, request }) => {
    const g = await tempGroup(request, uniq('E2E дом'), ['Вера Домова']);
    try {
      await loginApi(request);
      const issued = await (await request.post(`/api/teacher/students/${g.credentials[0].id}/parents`, { headers: { 'x-heroes-client': '1' } })).json();

      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 375, height: 812 });
      await loginUi(page, issued.login, issued.password);
      await page.getByRole('button', { name: 'Дома', exact: true }).click();
      await expect(page.getByText('Домашних целей пока нет')).toBeVisible();
      await axe(page);

      await page.getByRole('button', { name: 'Новая цель' }).click();
      await page.getByLabel('Цель', { exact: true }).fill('Убирать комнату без напоминаний');
      await page.getByLabel('Сколько баллов собрать').fill('3');
      await axe(page);
      await page.getByRole('button', { name: 'Сохранить', exact: true }).click();

      const plus = page.getByRole('button', { name: 'Добавить балл: Убирать комнату без напоминаний' });
      await plus.click();
      await expect(page.getByRole('heading', { name: 'Домашние баллы: 1' })).toBeVisible();

      await page.getByRole('button', { name: 'Начислить', exact: true }).click();
      await page.getByRole('dialog').getByLabel('Цель', { exact: true }).selectOption({ label: 'Убирать комнату без напоминаний' });
      await page.getByLabel('Баллы, от 1 до 10').fill('2');
      await axe(page);
      await page.getByRole('dialog').getByRole('button', { name: 'Начислить', exact: true }).click();
      await expect(page.getByText('Достигнута')).toBeVisible();
      await expect(plus).toHaveCount(0);

      await page.getByRole('button', { name: 'Начислить', exact: true }).click();
      await page.getByLabel('За что').fill('Помог бабушке с покупками');
      await page.getByRole('dialog').getByRole('button', { name: 'Начислить', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Домашние баллы: 4' })).toBeVisible();
      await narrow(page);
      await page.screenshot({ path: test.info().outputPath(`home-parent-${colorScheme}.png`), fullPage: true });
      await axe(page);

      await page.getByRole('button', { name: 'Отменить начисление: Помог бабушке с покупками' }).click();
      await expect(page.getByRole('heading', { name: 'Домашние баллы: 3' })).toBeVisible();

      const pupilContext = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme });
      const pupil = await pupilContext.newPage();
      await pupil.setViewportSize({ width: 375, height: 812 });
      await loginUi(pupil, g.credentials[0].login, g.credentials[0].password);
      const home = pupil.getByRole('region', { name: 'Домашние баллы' });
      await expect(home.getByRole('heading', { name: 'Домашние баллы: 3' })).toBeVisible();
      await expect(home.getByText('Убирать комнату без напоминаний').first()).toBeVisible();
      await expect(home.getByRole('button')).toHaveCount(0);
      await narrow(pupil);
      await pupil.screenshot({ path: test.info().outputPath(`home-student-${colorScheme}.png`), fullPage: true });
      await axe(pupil);

      await pupil.goto('/shop');
      await expect(pupil.getByText('можно потратить')).toBeVisible();
      const shop = await (await pupil.request.get('/api/student/shop')).json();
      expect(shop.balance).toBe(0);
      await pupilContext.close();
    } finally {
      await g.remove();
    }
  });
}
