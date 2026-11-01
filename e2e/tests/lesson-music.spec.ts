import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { TEACHER, loginUi, tempGroup, uniq } from './helpers';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`музыка на уроке: включение, смена мелодии, проектор и телефон (${colorScheme})`, async ({ page, request }) => {
    const g = await tempGroup(request, uniq('E2E музыка'), ['Лиза Ершова', 'Марк Орлов']);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${g.id}`);
      await page.getByRole('button', { name: 'Музыка', exact: true }).click();
      const music = page.getByRole('region', { name: 'Музыка на уроке', exact: true });
      await music.getByRole('button', { name: 'Включить', exact: true }).click();
      await expect(music.getByRole('status')).toHaveText('Играет: Тихое утро');
      await music.getByRole('button', { name: 'Дождь за окном', exact: true }).click();
      await expect(music.getByRole('status')).toHaveText('Играет: Дождь за окном');

      await page.getByRole('button', { name: 'Проектор', exact: true }).click();
      const projector = page.locator('.fixed.inset-0.z-40').filter({ has: page.getByRole('button', { name: 'Выйти из режима проектора' }) });
      await expect(projector.getByRole('status').filter({ hasText: 'Играет' })).toHaveText('Играет: Дождь за окном');
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
      await page.screenshot({ path: test.info().outputPath(`lesson-music-projector-${colorScheme}.png`) });
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      await page.getByRole('button', { name: 'Выйти из режима проектора' }).click();
      await expect(projector).toHaveCount(0);

      await page.setViewportSize({ width: 375, height: 812 });
      await expect(music.getByRole('status')).toHaveText('Играет: Дождь за окном');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await music.screenshot({ path: test.info().outputPath(`lesson-music-mobile-${colorScheme}.png`) });
      await music.getByRole('button', { name: 'Остановить', exact: true }).click();
      await expect(music.getByRole('status')).toHaveText('Музыка выключена');
    } finally {
      await g.remove();
    }
  });
}
