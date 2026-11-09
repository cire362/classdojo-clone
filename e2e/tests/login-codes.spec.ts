import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { animationsDone, loginUi, TEACHER, tempGroup, uniq } from './helpers';

const axe = async (page: import('@playwright/test').Page) => {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

async function signedInAs(page: import('@playwright/test').Page, name: string) {
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
  expect((await (await page.request.get('/api/auth/me')).json()).user).toMatchObject({ role: 'STUDENT', name });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`вход ученика по QR-карточке и коду класса (${colorScheme})`, async ({ page, browser, request }) => {
    const g = await tempGroup(request, uniq('E2E коды'), ['Лиза Ершова', 'Марк Орлов']);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();

      // Карточки: токен виден только в ответе, на листе он внутри QR
      await page.goto(`/g/${g.id}/students`);
      await page.getByRole('button', { name: 'QR-карточки', exact: true }).click();
      const issued = page.waitForResponse((r) => r.url().endsWith('/login-cards'));
      await page.getByRole('button', { name: 'Выпустить', exact: true }).click();
      const { cards } = await (await issued).json();
      await expect(page.getByRole('heading', { name: 'QR-карточки для входа' })).toBeVisible();
      await expect(page.getByRole('img', { name: 'QR-код для входа: Лиза Ершова' })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`login-cards-${colorScheme}.png`) });
      await axe(page);

      const student = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme });
      const phone = await student.newPage();
      await phone.setViewportSize({ width: 375, height: 812 });
      await phone.goto(`/q#${cards[0].token}`);
      await signedInAs(phone, 'Лиза Ершова');
      expect(new URL(phone.url()).hash).toBe('');
      await student.close();

      // Код класса
      await page.goto(`/g/${g.id}`);
      await page.getByRole('button', { name: 'Код класса', exact: true }).click();
      const panel = page.getByRole('region', { name: 'Код класса', exact: true });
      await panel.getByRole('button', { name: 'Включить код класса', exact: true }).click();
      await expect(panel.getByRole('img', { name: /QR-код для входа, код/ })).toBeVisible();
      const code = (await panel.locator('.font-mono').innerText()).trim();
      await panel.screenshot({ path: test.info().outputPath(`class-code-${colorScheme}.png`) });

      await page.getByRole('button', { name: 'Проектор', exact: true }).click();
      await expect(page.getByText(code, { exact: true })).toBeVisible();
      await animationsDone(page);
      await page.screenshot({ path: test.info().outputPath(`class-code-projector-${colorScheme}.png`) });
      await axe(page);
      await page.getByRole('button', { name: 'Выйти из режима проектора' }).click();

      const pupil = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme });
      const tablet = await pupil.newPage();
      await tablet.setViewportSize({ width: 375, height: 812 });
      await tablet.goto('/login');
      await tablet.getByRole('link', { name: 'Войти по коду с экрана' }).click();
      await tablet.getByLabel('Код', { exact: true }).fill('WRONG2');
      await tablet.getByRole('button', { name: 'Дальше', exact: true }).click();
      await expect(tablet.getByRole('alert')).toContainText('Код не подошёл');
      await axe(tablet);
      await tablet.getByLabel('Код', { exact: true }).fill(code.toLowerCase());
      await tablet.getByRole('button', { name: 'Дальше', exact: true }).click();
      await expect(tablet.getByRole('heading', { name: 'Кто ты?' })).toBeVisible();
      expect(await tablet.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await tablet.screenshot({ path: test.info().outputPath(`join-class-${colorScheme}.png`) });
      await axe(tablet);
      await tablet.getByRole('button', { name: /Марк О\./ }).click();
      await signedInAs(tablet, 'Марк Орлов');

      // Отключённый код больше не работает
      await panel.getByRole('button', { name: 'Отключить', exact: true }).click();
      await expect(panel.getByRole('button', { name: 'Включить код класса', exact: true })).toBeVisible();
      await tablet.goto(`/join#${code}`);
      await expect(tablet.getByRole('alert')).toContainText('Код не подошёл');
      await pupil.close();
    } finally {
      await g.remove();
    }
  });
}
