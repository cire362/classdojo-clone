import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { TEACHER, loginUi, tempGroup, uniq } from './helpers';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`план урока: шаги, сохранение, проектор и телефон (${colorScheme})`, async ({ page, request }) => {
    const g = await tempGroup(request, uniq('E2E план'), ['Лиза Ершова', 'Марк Орлов']);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${g.id}`);
      await page.getByRole('button', { name: 'План урока', exact: true }).click();
      const plan = page.getByRole('region', { name: 'План урока', exact: true });
      await plan.getByLabel('Шаги урока, по одному на строку').fill('Разминка\nНовая тема\nИтоги урока');
      await plan.getByRole('button', { name: 'Сохранить', exact: true }).click();
      await expect(plan.getByRole('status')).toHaveText('Сейчас, шаг 1 из 3');
      await plan.getByRole('button', { name: 'Следующий шаг', exact: true }).click();
      await expect(plan.getByRole('status')).toHaveText('Сейчас, шаг 2 из 3');

      // План на сервере: после перезагрузки тот же шаг
      await page.reload();
      await expect(page.getByRole('button', { name: /План урока · 2 из 3/ })).toBeVisible();

      await page.getByRole('button', { name: 'Проектор', exact: true }).click();
      const projector = page.locator('.fixed.inset-0.z-40').filter({ has: page.getByRole('button', { name: 'Выйти из режима проектора' }) });
      const shown = projector.getByRole('region', { name: 'План урока', exact: true });
      await expect(shown.getByRole('status')).toHaveText('Сейчас, шаг 2 из 3');
      await expect(shown.getByText('Дальше: Итоги урока')).toBeVisible();
      await shown.getByRole('button', { name: 'Следующий шаг', exact: true }).click();
      await expect(shown.getByRole('status')).toHaveText('Сейчас, шаг 3 из 3');
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
      await page.screenshot({ path: test.info().outputPath(`lesson-plan-projector-${colorScheme}.png`) });
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      await page.getByRole('button', { name: 'Выйти из режима проектора' }).click();
      await expect(projector).toHaveCount(0);

      await page.setViewportSize({ width: 375, height: 812 });
      await page.getByRole('button', { name: /План урока · 3 из 3/ }).click();
      await expect(plan.getByRole('status')).toHaveText('Сейчас, шаг 3 из 3');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await plan.screenshot({ path: test.info().outputPath(`lesson-plan-mobile-${colorScheme}.png`) });
      await plan.getByRole('button', { name: 'Изменить', exact: true }).click();
      await plan.getByRole('button', { name: 'Очистить план', exact: true }).click();
      await expect(plan.getByLabel('Шаги урока, по одному на строку')).toHaveValue('');
    } finally {
      await g.remove();
    }
  });
}
