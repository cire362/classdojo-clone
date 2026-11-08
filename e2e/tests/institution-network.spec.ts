import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginUi } from './helpers';

const NETWORK = { login: process.env.E2E_NETWORK_LOGIN ?? 'network', password: process.env.E2E_NETWORK_PASSWORD ?? 'network12345' };

test('руководитель сети видит сводку по учреждениям и скачивает её', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loginUi(page, NETWORK.login, NETWORK.password);
  await expect(page.getByRole('heading', { name: 'Демо-сеть учреждений' })).toBeVisible();
  const table = page.getByRole('region', { name: 'Учреждения сети' });
  await expect(table.getByRole('row', { name: /^Всего/ })).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(3);
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: /Excel/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^Демо-сеть учреждений .+\.xlsx$/);
});
