import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { animationsDone, loginUi, TEACHER, tempGroup, uniq } from './helpers';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`таймер: пауза, перезагрузка, проектор, группы и завершение (${colorScheme})`, async ({ page, request }) => {
    const g = await tempGroup(request, uniq('E2E таймер'), ['Лиза Ершова', 'Марк Орлов']);
    const other = await tempGroup(request, uniq('E2E другой таймер'));
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${g.id}`);
      await page.getByRole('button', { name: 'Таймер', exact: true }).click();
      const timer = page.getByRole('region', { name: 'Таймер урока', exact: true });
      await page.clock.install();
      await timer.getByRole('button', { name: '3 мин', exact: true }).click();
      await expect(timer.getByRole('timer')).toHaveText('03:00');
      await timer.getByLabel('Секунды', { exact: true }).fill('10');
      await timer.getByRole('button', { name: 'Начать', exact: true }).click();
      await page.clock.runFor(2000);
      await timer.getByRole('button', { name: 'Пауза', exact: true }).click();
      await expect(timer.getByRole('timer')).toHaveText('03:08');
      await page.clock.fastForward(20_000);
      await expect(timer.getByRole('timer')).toHaveText('03:08');
      await page.reload();
      await expect(timer.getByRole('timer')).toHaveText('03:08');
      await expect(timer.getByRole('checkbox', { name: 'Звук по окончании' })).not.toBeChecked();
      await page.screenshot({ path: test.info().outputPath(`timer-lesson-${colorScheme}.png`) });

      await page.getByRole('button', { name: 'Проектор', exact: true }).click();
      const projector = page.locator('.fixed.inset-0.z-40').filter({ has: page.getByRole('button', { name: 'Выйти из режима проектора' }) });
      await expect(projector.getByRole('timer')).toHaveText('03:08');
      await timer.getByRole('button', { name: 'Продолжить', exact: true }).click();
      await page.clock.runFor(1000);
      await timer.getByRole('button', { name: 'Пауза', exact: true }).click();
      await expect(timer.getByRole('timer')).toHaveText('03:07');
      await animationsDone(page);
      await page.screenshot({ path: test.info().outputPath(`timer-projector-${colorScheme}.png`) });
      let result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      await page.getByRole('button', { name: 'Выйти из режима проектора' }).click();
      await expect(projector).toHaveCount(0);
      await expect(timer.getByRole('timer')).toHaveText('03:07');

      await page.setViewportSize({ width: 375, height: 812 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await timer.screenshot({ path: test.info().outputPath(`timer-mobile-paused-${colorScheme}.png`) });
      await timer.getByRole('button', { name: 'Скрыть таймер' }).click();
      await expect(timer.getByRole('button', { name: /Таймер.*03:07/ })).toBeVisible();
      await timer.getByRole('button', { name: /^Таймер/ }).click();
      await expect(timer.getByRole('timer')).toHaveText('03:07');

      await page.goto(`/g/${other.id}`);
      await expect(page.getByRole('heading', { name: 'В группе пока нет учеников' })).toBeVisible();
      await timer.getByRole('button', { name: 'Таймер', exact: true }).click();
      await expect(timer.getByRole('timer')).toHaveText('05:00');
      await page.goto(`/g/${g.id}`);
      await expect(timer.getByRole('timer')).toHaveText('03:07');
      await timer.getByRole('button', { name: 'Сбросить', exact: true }).click();
      await expect(timer.getByRole('timer')).toHaveText('03:10');
      await timer.screenshot({ path: test.info().outputPath(`timer-mobile-settings-${colorScheme}.png`) });
      await page.screenshot({ path: test.info().outputPath(`timer-mobile-context-${colorScheme}.png`) });
      await timer.getByRole('button', { name: 'Начать', exact: true }).click();
      await page.clock.fastForward(191_000);
      await expect(timer.getByRole('timer')).toHaveText('00:00');
      await expect(timer.getByRole('status')).toHaveText('Время вышло!');
      await expect(timer.getByRole('button', { name: 'Начать снова', exact: true })).toBeFocused();
      await page.clock.fastForward(60_000);
      await expect(timer.getByRole('timer')).toHaveText('00:00');
      await timer.screenshot({ path: test.info().outputPath(`timer-mobile-finished-${colorScheme}.png`) });
      result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    } finally {
      await other.remove();
      await g.remove();
    }
  });
}
