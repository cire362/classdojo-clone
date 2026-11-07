import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { TEACHER, loginUi } from './helpers';

const ADMIN = { login: process.env.E2E_ADMIN_LOGIN ?? 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'admin12345' };
const PARENT = { login: process.env.E2E_PARENT_LOGIN ?? 'parent', password: process.env.E2E_PARENT_PASSWORD ?? 'parent12345' };
const axe = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

async function setKind(page: Page, kind: string) {
  await page.getByRole('button', { name: 'Изменить название и тип' }).click();
  await page.getByLabel('Тип учреждения').selectOption({ label: kind });
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText(kind, { exact: true })).toBeVisible();
}

test('тип учреждения меняет слова у администрации, преподавателя и родителя', async ({ page, browser }) => {
  await loginUi(page, ADMIN.login, ADMIN.password);
  await expect(page.getByText('Школа', { exact: true })).toBeVisible();
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    await setKind(page, 'Вуз');
    await expect(page.getByRole('main').getByText('Ректор', { exact: true })).toBeVisible();
    for (const tab of ['Ящик вуза', 'Группы вуза', 'Баллы вуза', 'Лента вуза']) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Администрация', exact: true }).click();
    await expect(page.getByRole('main').getByText('Проректор', { exact: true }).first()).toBeVisible();
    await axe(page);

    const teacher = await context.newPage();
    await teacher.setViewportSize({ width: 375, height: 812 });
    await loginUi(teacher, TEACHER.login, TEACHER.password);
    await teacher.getByRole('link', { name: /Новости вуза/ }).click();
    await expect(teacher.getByRole('heading', { name: 'Новости вуза', level: 1 })).toBeVisible();
    await axe(teacher);

    await setKind(page, 'Колледж или техникум');
    await expect(page.getByRole('main').getByText('Заместитель директора', { exact: true }).first()).toBeVisible();
    await context.clearCookies();
    const parent = await context.newPage();
    await parent.setViewportSize({ width: 375, height: 812 });
    await loginUi(parent, PARENT.login, PARENT.password);
    await parent.getByRole('link', { name: /Письмо в колледж/ }).click();
    await expect(parent.getByRole('heading', { name: 'Письмо в колледж', level: 1 })).toBeVisible();
    await axe(parent);
    expect(await parent.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
  } finally {
    await context.close();
    // Демо-учреждение снова школа: стенд общий для всех тестов
    await page.goto('/');
    await setKind(page, 'Школа');
  }
});
