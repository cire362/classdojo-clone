import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { animationsDone, loginUi, TEACHER, tempGroup, uniq } from './helpers';

const TITLE = 'Подумай — обсуди — поделись';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`подумай — обсуди — поделись: этапы, проектор и телефон (${colorScheme})`, async ({ page, request }) => {
    const g = await tempGroup(request, uniq('E2E этапы'), ['Лиза Ершова', 'Марк Орлов']);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${g.id}`);
      await page.getByRole('button', { name: TITLE, exact: true }).click();
      const tool = page.getByRole('region', { name: TITLE, exact: true });
      await page.clock.install();
      await tool.getByRole('textbox', { name: 'Обсуди, мин' }).fill('4');
      await tool.getByRole('button', { name: 'Начать', exact: true }).click();
      const clock = tool.getByRole('timer', { name: 'Осталось на этапе' });
      await expect(clock).toHaveText('01:00');
      await page.clock.fastForward(61_000);
      await expect(clock).toHaveText('00:00');
      await expect(tool.getByRole('status')).toContainText('Время вышло!');
      await expect(tool.getByRole('button', { name: 'Ещё минута', exact: true })).toBeFocused();

      await tool.getByRole('button', { name: 'Дальше: Обсуди', exact: true }).click();
      await expect(clock).toHaveText('04:00');
      await page.reload();
      await expect(clock).toHaveText(/^0[34]:/);
      await expect(tool.getByRole('listitem').and(page.locator('[aria-current="step"]'))).toHaveText('2. Обсуди');
      await tool.getByRole('button', { name: 'Пауза', exact: true }).click();

      await page.getByRole('button', { name: 'Проектор', exact: true }).click();
      const projector = page.locator('.fixed.inset-0.z-40').filter({ has: page.getByRole('button', { name: 'Выйти из режима проектора' }) });
      await expect(projector.getByRole('timer', { name: 'Осталось на этапе' })).toBeVisible();
      await animationsDone(page);
      await page.screenshot({ path: test.info().outputPath(`think-pair-share-projector-${colorScheme}.png`) });
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      await page.getByRole('button', { name: 'Выйти из режима проектора' }).click();
      await expect(projector).toHaveCount(0);

      await page.setViewportSize({ width: 375, height: 812 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await tool.screenshot({ path: test.info().outputPath(`think-pair-share-mobile-${colorScheme}.png`) });
      await tool.getByRole('button', { name: 'Завершить', exact: true }).click();
      await expect(tool.getByRole('textbox', { name: 'Обсуди, мин' })).toHaveValue('4');
    } finally {
      await g.remove();
    }
  });
}
