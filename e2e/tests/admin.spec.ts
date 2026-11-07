import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginUi } from './helpers';

const ADMIN = { login: process.env.E2E_ADMIN_LOGIN ?? 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'admin12345' };

test('администратор создаёт преподавателя и восстанавливает ему вход', async ({ page, browser }) => {
  await loginUi(page, ADMIN.login, ADMIN.password);
  await expect(page.getByRole('main').getByText('Директор', { exact: true })).toBeVisible();

  // Название школы меняется и возвращается: стенд общий для всех тестов
  const title = page.getByRole('heading', { level: 1 });
  const original = await title.innerText();
  await page.getByRole('button', { name: 'Изменить название и тип' }).click();
  await page.getByLabel('Название', { exact: true }).fill('E2E Гимназия');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(title).toHaveText('E2E Гимназия');
  await page.getByRole('button', { name: 'Изменить название и тип' }).click();
  await page.getByLabel('Название', { exact: true }).fill(original);
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(title).toHaveText(original);

  const login = `e2e.${Date.now().toString(36)}`;
  const name = 'E2E Новый преподаватель';
  await page.getByRole('button', { name: 'Добавить преподавателя' }).click();
  await page.fill('#teacher-name', name);
  await page.fill('#teacher-login', login);
  await page.getByRole('button', { name: 'Создать вход' }).click();
  const issued = page.getByRole('dialog', { name: 'Передайте данные преподавателю' });
  await expect(issued).toBeVisible();
  const password = await issued.locator('dd').nth(1).innerText();
  await page.getByRole('button', { name: 'Данные сохранены, закрыть' }).click();
  await expect(issued).toHaveCount(0);

  const teacher = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage();
  try {
    await loginUi(teacher, login, password);
    await expect(teacher.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    expect((await teacher.request.get('/api/admin/teachers')).status()).toBe(403);
    await page.getByRole('button', { name: `Новый пароль: ${name}` }).click();
    await page.getByRole('button', { name: 'Выдать новый пароль', exact: true }).click();
    await expect(issued).toBeVisible();
    const replacement = await issued.locator('dd').nth(1).innerText();
    await teacher.reload();
    await expect(teacher.getByRole('heading', { name: 'Вход', exact: true })).toBeVisible();
    await loginUi(teacher, login, replacement);
    await expect(teacher.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    await page.getByRole('button', { name: 'Данные сохранены, закрыть' }).click();
    await page.getByRole('button', { name: `Премиум: ${name}` }).click();
    const until = `${new Date().getFullYear() + 1}-06-30`;
    await page.fill('#premium-until', until);
    await page.getByRole('button', { name: 'Сохранить срок' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Классы школы', exact: true }).click();
    await expect(page.getByText('Анна Сергеевна', { exact: true }).first()).toBeVisible();
  } finally {
    await teacher.context().close();
  }
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`администратор: доступность и телефон (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await loginUi(page, ADMIN.login, ADMIN.password);
    await expect(page.getByRole('main').getByText('Директор', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    for (const section of ['Преподаватели', 'Классы школы', 'Администрация']) {
      await page.getByRole('button', { name: section, exact: true }).click();
      await expect(page.locator('main li').first()).toBeVisible();
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help}: ${v.nodes.map((n) => n.target.join(',') + ':' + n.failureSummary).join(';')}`)).toEqual([]);
      await page.setViewportSize({ width: 375, height: 812 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await page.screenshot({ path: test.info().outputPath(`admin-${section}-mobile.png`), fullPage: true });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.screenshot({ path: test.info().outputPath(`admin-${section}-desktop.png`), fullPage: true });
    }
  });
}
