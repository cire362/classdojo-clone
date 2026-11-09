import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { animationsDone, loginUi, tempGroup, uniq } from './helpers';

const ADMIN = { login: process.env.E2E_ADMIN_LOGIN ?? 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'admin12345' };

test('панель руководителя: обзор по классам и параллелям, выгрузка в Excel и PDF', async ({ page, request }) => {
  const group = await tempGroup(request, uniq('E2E обзор'), ['Вера Лосева']);
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginUi(page, ADMIN.login, ADMIN.password);
    await page.getByRole('button', { name: 'Обзор', exact: true }).click();
    const table = page.getByRole('region', { name: 'Таблица обзора' });
    await expect(table.getByRole('row', { name: /E2E обзор/ })).toBeVisible();
    await expect(table.getByRole('row', { name: /^Всего/ })).toBeVisible();

    await page.getByLabel('Разрез').selectOption({ label: 'Параллели' });
    await expect(table.getByRole('columnheader').first()).toHaveText('Параллели');
    await animationsDone(page);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);

    for (const [name, ext] of [['Excel', 'xlsx'], ['PDF', 'pdf']]) {
      const download = page.waitForEvent('download');
      await page.getByRole('link', { name }).click();
      expect((await download).suggestedFilename()).toMatch(new RegExp(`^Обзор по параллелям .+\\.${ext}$`));
    }
  } finally {
    await group.remove();
  }
});
