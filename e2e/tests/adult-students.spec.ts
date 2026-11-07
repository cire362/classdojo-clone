import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loginUi, tempGroup, uniq } from './helpers';

const ADMIN = { login: process.env.E2E_ADMIN_LOGIN ?? 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'admin12345' };
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

test('студент вуза без родителей сам пишет в ящик учреждения', async ({ page, browser, request }) => {
  await loginUi(page, ADMIN.login, ADMIN.password);
  await setKind(page, 'Вуз');
  const g = await tempGroup(request, uniq('E2E ИВТ'), ['Лиза Ершова']);
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    expect((await (await request.get(`/api/teacher/groups/${g.id}`)).json()).group.parentsEnabled).toBe(false);
    const question = uniq('E2E нужна справка');
    const student = await context.newPage();
    await student.setViewportSize({ width: 375, height: 812 });
    await loginUi(student, g.credentials[0].login, g.credentials[0].password);
    await expect(student.getByRole('link', { name: /Новости вуза/ })).toBeVisible();
    await student.getByRole('link', { name: /Письмо в вуз/ }).click();
    await expect(student.getByRole('heading', { name: 'Письмо в вуз', level: 1 })).toBeVisible();
    await student.getByLabel('Сообщение').fill(question);
    await student.getByRole('button', { name: 'Отправить' }).click();
    await expect(student.getByText(question)).toBeVisible();
    await axe(student);
    expect(await student.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);

    await page.getByRole('button', { name: /^Ящик вуза/ }).click();
    const row = page.getByRole('list', { name: 'Переписки с семьями' }).getByRole('button').filter({ hasText: question });
    await expect(row).toContainText('Студент: Лиза Ершова');
  } finally {
    await context.close();
    await g.remove();
    await page.goto('/');
    await setKind(page, 'Школа');
  }
});
