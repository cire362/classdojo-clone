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
  test(`модерация: родитель жалуется на комментарий, преподаватель скрывает его (${colorScheme})`, async ({ page, browser, request }) => {
    const g = await tempGroup(request, uniq('E2E модерация'), ['Лиза Ершова', 'Марк Орлов']);
    try {
      await loginApi(request);
      const issue = async (i: number) =>
        (await request.post(`/api/teacher/students/${g.credentials[i].id}/parents`, { headers: H })).json();
      const [mom, dad] = [await issue(0), await issue(1)];
      const post = await (await request.post(`/api/teacher/groups/${g.id}/feed`, { data: { text: 'Итоги четверти' }, headers: H })).json();

      // Второй родитель пишет грубый комментарий через API
      const dadContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
      await loginApi(dadContext.request, dad.login, dad.password);
      const dadFeed = `/api/parent/children/${g.credentials[1].id}/feed`;
      await dadContext.request.post(`${dadFeed}/${post.id}/comments`, { data: { text: 'Грубый комментарий' }, headers: H });

      const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme, reducedMotion: 'reduce' });
      const home = await context.newPage();
      await home.setViewportSize({ width: 375, height: 812 });
      await loginUi(home, mom.login, mom.password);
      await home.getByRole('button', { name: /Лента класса/ }).click();
      await home.getByRole('button', { name: 'Пожаловаться на комментарий' }).click();
      const dialog = home.getByRole('dialog', { name: 'Жалоба на комментарий' });
      await dialog.getByText('Грубость или оскорбление').click();
      await dialog.getByLabel('Пояснение, если нужно').fill('Обижает детей');
      expect(await home.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await axe(home);
      await dialog.getByRole('button', { name: 'Отправить жалобу' }).click();
      await expect(home.getByText('Вы пожаловались')).toBeVisible();
      await axe(home);
      await context.close();

      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${g.id}/feed`);
      const panel = page.getByRole('region', { name: 'Жалобы родителей: 1' });
      await expect(panel.getByText('Грубость или оскорбление: 1')).toBeVisible();
      await expect(panel.getByText('Обижает детей')).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`moderation-queue-${colorScheme}.png`) });
      await axe(page);
      await panel.getByRole('button', { name: 'Скрыть' }).click();
      await expect(page.getByRole('region', { name: /Жалобы родителей/ })).toHaveCount(0);
      await expect(page.getByLabel('Комментарии').getByText('Скрыт', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Журнал модерации' }).click();
      const log = page.getByRole('dialog', { name: 'Журнал модерации' });
      await expect(log.getByText('Скрыто', { exact: true })).toBeVisible();
      await expect(log.getByText('Жалоба', { exact: true })).toBeVisible();
      await axe(page);

      const seen = await (await dadContext.request.get(dadFeed, { headers: H })).json();
      expect(seen[0].comments).toEqual([]);
      await dadContext.close();
    } finally {
      await g.remove();
    }
  });
}
