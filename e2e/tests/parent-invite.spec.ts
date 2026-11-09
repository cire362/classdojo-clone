import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { animationsDone, loginUi, TEACHER, tempGroup, uniq } from './helpers';

const axe = async (page: Page) => {
  await animationsDone(page);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

for (const colorScheme of ['light', 'dark'] as const) {
  test(`родитель принимает приглашение и сам задаёт пароль (${colorScheme})`, async ({ page, browser, request }) => {
    const g = await tempGroup(request, uniq('E2E приглашения'), ['Лиза Ершова', 'Марк Орлов']);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${g.id}/students`);
      await page.getByRole('link', { name: /Лиза Ершова/ }).click();
      await page.getByRole('button', { name: 'Пригласить', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('img', { name: /QR-код приглашения/ })).toBeVisible();
      const link = (await dialog.locator('.break-all').innerText()).trim();
      const code = link.split('#')[1];
      await axe(page);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('list', { name: 'Действующие приглашения' })).toBeVisible();

      const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme });
      const parent = await context.newPage();
      await parent.setViewportSize({ width: 375, height: 812 });
      await parent.goto('/login');
      await parent.getByRole('link', { name: 'У меня приглашение для родителей' }).click();
      await parent.getByLabel('Код приглашения').fill(`${code.slice(0, 5)}-${code.slice(5)}`.toLowerCase());
      await parent.getByRole('button', { name: 'Дальше', exact: true }).click();
      await expect(parent.getByRole('heading', { name: 'Вход для родителей' })).toBeVisible();
      await parent.getByLabel('Пароль', { exact: true }).fill('родитель-пароль');
      await parent.getByLabel('Пароль ещё раз').fill('родитель-пароль');
      expect(await parent.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await parent.screenshot({ path: test.info().outputPath(`invite-password-${colorScheme}.png`) });
      await axe(parent);
      await parent.getByRole('button', { name: 'Создать вход', exact: true }).click();
      await expect(parent.getByRole('heading', { name: 'Вход создан' })).toBeVisible();
      const login = (await parent.locator('.font-mono').innerText()).trim();
      await parent.getByRole('button', { name: 'В кабинет', exact: true }).click();
      await expect(parent.getByRole('button', { name: 'Выйти' })).toBeVisible();

      // Повторно приглашение не работает, а новым паролем можно войти
      await context.clearCookies();
      await parent.goto(link);
      await expect(parent.getByRole('alert')).toContainText('Приглашение не подошло');
      await loginUi(parent, login, 'родитель-пароль');
      await expect(parent.getByRole('button', { name: 'Выйти' })).toBeVisible();
      await context.close();

      await page.reload();
      await expect(page.getByText(login)).toBeVisible();
      await expect(page.getByRole('list', { name: 'Действующие приглашения' })).toHaveCount(0);

      // Лист на собрание
      await page.goto(`/g/${g.id}/students`);
      await page.getByRole('button', { name: 'Входы родителям' }).click();
      await page.getByRole('button', { name: 'Приглашения с QR-кодом', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Приглашения для родителей' })).toBeVisible();
      await expect(page.getByRole('img', { name: 'QR-код приглашения: Марк Орлов' })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`invite-sheet-${colorScheme}.png`) });
      await axe(page);
    } finally {
      await g.remove();
    }
  });
}
