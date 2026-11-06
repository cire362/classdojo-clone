import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { TEACHER, loginUi, tempGroup, uniq } from './helpers';

const axe = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

for (const colorScheme of ['light', 'dark'] as const) {
  test(`лента: закрепление, отложенная запись, реакции и комментарии (${colorScheme})`, async ({ page, browser, request }) => {
    const g = await tempGroup(request, uniq('E2E лента'), ['Лиза Ершова']);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${g.id}/feed`);

      const field = page.getByLabel('Объявление для учеников и родителей');
      await field.fill('Завтра экскурсия');
      await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
      const post = page.getByRole('listitem').filter({ hasText: 'Завтра экскурсия' });
      await post.getByRole('button', { name: 'Закрепить запись' }).click();
      await expect(post.getByText('Закреплено')).toBeVisible();

      await field.fill('Секретная запись на завтра');
      await page.getByLabel('Опубликовать позже').check();
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
      const stamp = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}T09:30`;
      await page.getByLabel('Дата и время публикации').fill(stamp);
      await page.getByRole('button', { name: 'Запланировать', exact: true }).click();
      await expect(page.getByText('Выйдет в это время')).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`feed-teacher-${colorScheme}.png`), fullPage: true });
      await axe(page);

      const student = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme });
      const pupil = await student.newPage();
      await pupil.setViewportSize({ width: 375, height: 812 });
      await loginUi(pupil, g.credentials[0].login, g.credentials[0].password);
      await expect(pupil.getByRole('button', { name: 'Выйти' })).toBeVisible();
      await pupil.goto('/feed');
      const seen = pupil.getByRole('listitem').filter({ hasText: 'Завтра экскурсия' });
      await expect(seen).toBeVisible();
      await expect(pupil.getByText('Секретная запись на завтра')).toHaveCount(0);
      await seen.getByRole('button', { name: 'Отлично: 0' }).click();
      await expect(seen.getByRole('button', { name: 'Отлично: 1' })).toHaveAttribute('aria-pressed', 'true');
      await expect(seen.getByRole('textbox', { name: 'Комментарий', exact: true })).toHaveCount(0);
      expect(await pupil.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await axe(pupil);
      await student.close();

      await page.goto(`/g/${g.id}/feed`);
      await post.getByRole('textbox', { name: 'Комментарий', exact: true }).fill('Возьмите сменную обувь');
      await post.getByRole('button', { name: 'Отправить', exact: true }).click();
      await expect(post.getByRole('list', { name: 'Комментарии' })).toContainText('Возьмите сменную обувь');
      await expect(post.getByRole('button', { name: 'Отлично: 1' })).toBeVisible();
      await page.setViewportSize({ width: 375, height: 812 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await post.screenshot({ path: test.info().outputPath(`feed-post-mobile-${colorScheme}.png`) });
      // Без force: при прокрутке переключатель может уйти под закреплённую шапку
      await page.getByText('Комментарии родителей', { exact: true }).click();
      await expect(page.getByRole('checkbox', { name: 'Комментарии родителей' })).not.toBeChecked();
      await expect(post.getByRole('list', { name: 'Комментарии' })).toBeVisible();
      await expect(post.getByRole('textbox', { name: 'Комментарий', exact: true })).toHaveCount(0);
    } finally {
      await g.remove();
    }
  });
}
