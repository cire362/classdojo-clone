import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { animationsDone, loginUi, TEACHER, tempGroup, uniq } from './helpers';

const axe = async (page: Page) => {
  await animationsDone(page);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

for (const colorScheme of ['light', 'dark'] as const) {
  test(`сад маяков открыт сразу: маршрут, сохранение места, вкладка преподавателя (${colorScheme})`, async ({ page, request }) => {
    await page.emulateMedia({ colorScheme });
    const group = await tempGroup(request, uniq('E2E сад'), ['Мира Садовая']);
    try {
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${group.id}/world`);
      await expect(page.getByRole('heading', { name: 'Мир ученика · Сад маяков' })).toBeVisible();
      await expect(page.getByRole('button', { name: /6. Большой маяк/ })).toBeEnabled();
      await axe(page);

      const student = group.credentials[0];
      await page.context().clearCookies();
      await loginUi(page, student.login, student.password);
      await page.getByRole('link', { name: 'В Сад маяков' }).click();
      await expect(page.getByRole('heading', { name: 'Тихий причал' })).toBeVisible();
      await page.setViewportSize({ width: 375, height: 812 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await axe(page);
      for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Вправо' }).click();
      for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Вниз' }).click();
      await page.getByRole('button', { name: 'Зажечь маяк' }).click();
      await expect(page.getByText('Место «Тихий причал» восстановлено!')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Ручей встреч' })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('button', { name: /1. Тихий причал, восстановлено/ })).toBeVisible();
    } finally {
      await group.remove();
    }
  });
}
