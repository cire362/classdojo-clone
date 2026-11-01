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
  test(`сообщения: рассылка, отправка позже и настройка тихих часов (${colorScheme})`, async ({ page, browser, request }) => {
    const g = await tempGroup(request, uniq('E2E сообщения'), ['Лиза Ершова', 'Марк Орлов']);
    try {
      await loginApi(request);
      const parent = await (await request.post(`/api/teacher/students/${g.credentials[0].id}/parents`, { headers: H })).json();
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();

      await page.goto(`/g/${g.id}/students`);
      await page.getByRole('button', { name: 'Написать родителям', exact: true }).click();
      await page.getByRole('dialog').getByLabel('Сообщение').fill('В субботу субботник');
      await axe(page);
      await page.getByRole('button', { name: 'Отправить всем', exact: true }).click();
      await expect(page.getByText('Отправлено: 1 родителю')).toBeVisible();

      await page.goto(`/messages/${g.credentials[0].id}/${parent.parentId}`);
      await expect(page.getByText('В субботу субботник')).toBeVisible();
      await page.fill('#message-text', 'Завтра контрольная');
      await page.getByLabel('Отправить позже').check();
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
      const stamp = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}T09:30`;
      await page.getByLabel('Дата и время отправки').fill(stamp);
      await page.getByRole('button', { name: 'Отправить', exact: true }).click();
      await expect(page.getByText('Уйдёт в это время')).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`thread-scheduled-${colorScheme}.png`) });
      await axe(page);

      const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme });
      const home = await context.newPage();
      await home.setViewportSize({ width: 375, height: 812 });
      await loginUi(home, parent.login, parent.password);
      await home.getByRole('button', { name: /Сообщения/ }).click();
      await expect(home.getByText('В субботу субботник')).toBeVisible();
      await expect(home.getByText('Завтра контрольная')).toHaveCount(0);
      await context.close();

      await page.getByRole('button', { name: 'Отменить отправку', exact: true }).click();
      await expect(page.getByText('Завтра контрольная')).toHaveCount(0);

      // Настройку не сохраняем: преподаватель общий для всех тестов, а тихие часы скрыли бы его значки
      await page.goto('/settings');
      await page.getByRole('checkbox', { name: 'Включить тихие часы' }).click({ force: true });
      await expect(page.getByLabel('С', { exact: true })).toHaveValue('21:00');
      await page.setViewportSize({ width: 375, height: 812 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await page.getByRole('form', { name: 'Тихие часы' }).screenshot({ path: test.info().outputPath(`quiet-hours-${colorScheme}.png`) });
      await axe(page);
    } finally {
      await g.remove();
    }
  });
}
