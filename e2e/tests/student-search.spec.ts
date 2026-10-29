import { expect, test } from '@playwright/test';
import { TEACHER, loginUi, tempGroup, uniq } from './helpers';

test('поиск ученика на уроке и в списке, автор начисления в профиле', async ({ page, request }) => {
  const group = await tempGroup(request, uniq('E2E поиск'), ['Артём Ковалёв', 'Вера Соколова']);
  try {
    await loginUi(page, TEACHER.login, TEACHER.password);
    await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    await page.goto(`/g/${group.id}`);
    const search = page.getByRole('searchbox', { name: 'Поиск ученика' });
    await search.fill('ковалев');
    await expect(page.getByRole('button', { name: /^Артём Ковалёв/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Вера Соколова/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Несколько' }).click();
    await page.getByRole('button', { name: 'Выбрать найденных' }).click();
    await page.getByRole('button', { name: 'Начислить', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Помог другу/ }).click();
    await expect(page.getByRole('button', { name: /^Артём Ковалёв всего 1/ })).toBeVisible();
    await page.getByRole('button', { name: 'Очистить поиск' }).click();
    await expect(page.getByRole('button', { name: /^Вера Соколова всего 0/ })).toBeVisible();
    await page.getByRole('link', { name: 'Ученики', exact: true }).click();
    const credentials = group.credentials.find((c) => c.name === 'Артём Ковалёв')!;
    await search.fill(credentials.login);
    await expect(page.getByRole('link', { name: /Артём Ковалёв/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Вера Соколова/ })).toHaveCount(0);
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
    await page.screenshot({ path: test.info().outputPath('student-search-mobile.png'), fullPage: true });
    await page.getByRole('link', { name: /Артём Ковалёв/ }).click();
    const event = page.locator('li', { hasText: 'Помог другу' });
    await expect(event).toContainText('Анна Сергеевна');
    await page.screenshot({ path: test.info().outputPath('event-author-mobile.png'), fullPage: true });
  } finally {
    await group.remove();
  }
});
