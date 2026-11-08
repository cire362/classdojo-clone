import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { TEACHER, loginUi, tempGroup, uniq } from './helpers';

const ADMIN = { login: process.env.E2E_ADMIN_LOGIN ?? 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'admin12345' };
const axe = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

test('предмет группы: учитель назначен, баллы идут по предмету, сводка в статистике', async ({ page, request, playwright, baseURL }) => {
  const subject = uniq('E2E Физика');
  const group = await tempGroup(request, uniq('E2E предметы'), ['Вера Лосева']);
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginUi(page, TEACHER.login, TEACHER.password);
    await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    await page.goto(`/g/${group.id}/students`);
    await page.getByRole('button', { name: 'Настройки группы' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Предмет', { exact: true }).selectOption({ label: 'Новое название…' });
    await dialog.getByLabel('Название предмета').fill(subject);
    await dialog.getByLabel('Преподаватель').selectOption({ label: 'Игорь Павлович' });
    await dialog.getByRole('button', { name: 'Назначить' }).click();
    await expect(dialog.getByRole('list', { name: 'Предметы' })).toContainText(`${subject}Игорь Павлович`);
    await axe(page);
    await page.keyboard.press('Escape');

    await page.goto(`/g/${group.id}`);
    await page.getByRole('combobox', { name: 'Предмет' }).selectOption({ label: subject });
    await page.getByRole('button', { name: /^Вера Лосева/ }).click();
    await page.getByRole('button', { name: /Помог другу/ }).click();
    await expect(page.getByRole('button', { name: /^Вера Лосева всего 1/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);

    await page.goto(`/g/${group.id}/stats`);
    const summary = page.getByRole('region', { name: 'По предметам', exact: true });
    await expect(summary.getByRole('row', { name: new RegExp(subject) })).toContainText('+1');
    await axe(page);
  } finally {
    await group.remove();
    const admin = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { 'x-heroes-client': '1' } });
    await admin.post('/api/auth/login', { data: { login: ADMIN.login, password: ADMIN.password } });
    const list = await (await admin.get('/api/admin/subjects')).json();
    for (const s of list.filter((x: { name: string }) => x.name === subject)) await admin.delete(`/api/admin/subjects/${s.id}`);
    await admin.dispose();
  }
});
