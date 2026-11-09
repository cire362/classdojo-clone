import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { animationsDone, loginUi, tempGroup, uniq } from './helpers';

const ADMIN = { login: process.env.E2E_ADMIN_LOGIN ?? 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'admin12345' };

/**
 * Только предпросмотр: стенд общий для всех тестов, а переход меняет все группы учреждения.
 * Сам переход проверяют тесты API
 */
test('новый учебный год: директор видит, что станет с классами', async ({ page, request }) => {
  const name = uniq('7 «E2E»');
  const group = await tempGroup(request, name, ['Вера Лосева']);
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginUi(page, ADMIN.login, ADMIN.password);
    await page.getByRole('button', { name: /^Классы школы/ }).click();
    await page.getByRole('button', { name: `Подразделение и курс: ${name}` }).click();
    await page.getByRole('dialog').getByLabel('Параллель').selectOption('7');
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Новый учебный год' }).click();
    const dialog = page.getByRole('dialog', { name: 'Новый учебный год' });
    const item = dialog.getByRole('listitem').filter({ hasText: name });
    await expect(item).toContainText(`параллель 7 → 8, станет «${name.replace('7', '8')}»`);
    await item.getByLabel('Выпуск').check();
    await expect(item).toContainText('параллель 7 → выпуск, в архив');
    await animationsDone(page);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  } finally {
    await group.remove();
  }
});
