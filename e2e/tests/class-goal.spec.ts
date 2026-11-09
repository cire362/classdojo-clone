import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { animationsDone, loginUi, TEACHER, tempGroup, uniq } from './helpers';


for (const colorScheme of ['light', 'dark'] as const) {
  test(`цель класса: начисление, отмена, проектор и новая цель (${colorScheme})`, async ({ page, request }) => {
    const g = await tempGroup(request, uniq('E2E цель'), ['Лиза Ершова', 'Марк Орлов']);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${g.id}`);
      await page.getByRole('button', { name: 'Задать цель класса' }).click();
      await page.fill('#class-goal-title', 'Киноурок');
      await page.fill('#class-goal-target', '2');
      await page.getByRole('button', { name: 'Начать собирать' }).click();
      const goal = page.getByRole('region', { name: 'Цель класса', exact: true });
      await expect(goal).toContainText('Собрано 0 из 2 баллов');
      await page.getByRole('button', { name: 'Всей группе' }).click();
      await page.getByRole('dialog').getByRole('button', { name: /Помог другу/ }).click();
      await expect(goal.getByText('Цель достигнута!')).toBeVisible();
      await expect(goal.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
      await page.getByRole('button', { name: 'Отменить', exact: true }).click();
      await expect(goal).toContainText('Собрано 0 из 2 баллов');

      // Достижение меняется сразу, без перезагрузки. Теперь снова начисляем всей группе.
      await page.getByRole('button', { name: 'Всей группе' }).click();
      await page.getByRole('dialog').getByRole('button', { name: /Помог другу/ }).click();
      await expect(goal).toContainText('Собрано 2 из 2 баллов');
      await page.getByRole('button', { name: 'Проектор', exact: true }).click();
      const projector = page.locator('.fixed.inset-0.z-40').filter({ has: page.getByRole('button', { name: 'Выйти из режима проектора' }) });
      await expect(projector.getByRole('region', { name: 'Цель класса' })).toContainText('Цель достигнута!');
      await expect(projector.getByRole('button', { name: 'Изменить цель' })).toHaveCount(0);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await animationsDone(page);
      await page.screenshot({ path: test.info().outputPath(`goal-projector-${colorScheme}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Выйти из режима проектора' }).click();
      await expect(projector).toHaveCount(0);

      await page.setViewportSize({ width: 375, height: 812 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await animationsDone(page);
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`goal-mobile-${colorScheme}.png`), fullPage: true });

      await goal.getByRole('button', { name: 'Новая цель', exact: true }).click();
      await page.fill('#class-goal-title', 'Настольные игры');
      await page.fill('#class-goal-target', '5');
      await page.getByRole('button', { name: 'Начать с нуля' }).click();
      await expect(goal).toContainText('Собрано 0 из 5 баллов');
      await page.reload();
      await expect(goal).toContainText('Настольные игры');
      await expect(goal).toContainText('Собрано 0 из 5 баллов');
      const details = await (await request.get(`/api/teacher/groups/${g.id}`)).json();
      expect(details.students.map((s: { totalEarned: number }) => s.totalEarned)).toEqual([1, 1]);
    } finally {
      await g.remove();
    }
  });
}
