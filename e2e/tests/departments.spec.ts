import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loginUi, tempGroup, uniq } from './helpers';

const ADMIN = { login: process.env.E2E_ADMIN_LOGIN ?? 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'admin12345' };
const axe = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

/** Демо-учреждение снова школа после теста, даже если он прервался: стенд общий для всех тестов */
test.afterEach(async ({ playwright, baseURL }) => {
  const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { 'x-heroes-client': '1' } });
  await api.post('/api/auth/login', { data: { login: ADMIN.login, password: ADMIN.password } });
  await api.patch('/api/admin/school', { data: { kind: 'SCHOOL', heroes: true } });
  await api.dispose();
});

test('ректор заводит факультет и декана: декан видит только группы факультета', async ({ page, browser, request }) => {
  const faculty = uniq('E2E Факультет');
  const dean = { name: 'E2E Декан', login: `e2e.dean.${Date.now().toString(36)}` };
  await loginUi(page, ADMIN.login, ADMIN.password);
  await page.getByRole('button', { name: 'Изменить название и тип' }).click();
  await page.getByLabel('Тип учреждения').selectOption({ label: 'Вуз' });
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('button', { name: 'Факультеты', exact: true }).click();
  await page.getByRole('button', { name: /Добавить/ }).click();
  await page.getByRole('dialog').getByLabel('Название').fill(faculty);
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('list', { name: 'Факультеты' }).getByText(faculty)).toBeVisible();
  await axe(page);

  const mine = await tempGroup(request, uniq('E2E ИВТ'), ['Лиза Ершова']);
  const other = await tempGroup(request, uniq('E2E Чужая'), []);
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    await page.getByRole('button', { name: 'Группы вуза', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`Подразделение и курс: E2E ИВТ`) }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Подразделение').selectOption({ label: faculty });
    await dialog.getByLabel('Курс').selectOption('2');
    await dialog.getByLabel('Специальность или направление').fill('Информатика');
    await dialog.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByText(`${faculty} · курс 2 · Информатика`)).toBeVisible();

    await page.getByRole('button', { name: 'Администрация', exact: true }).click();
    await page.getByRole('button', { name: 'Добавить сотрудника' }).click();
    await page.getByLabel('Имя сотрудника').fill(dean.name);
    await page.getByLabel('Логин').fill(dean.login);
    await page.getByLabel('Должность', { exact: true }).selectOption({ label: 'Проректор' });
    await page.getByRole('button', { name: 'Создать вход' }).click();
    const password = await page.getByRole('dialog', { name: 'Передайте данные сотруднику' }).locator('dd').nth(1).innerText();
    await page.getByRole('button', { name: 'Данные сохранены, закрыть' }).click();
    await page.getByLabel(`Подразделение: ${dean.name}`).selectOption({ label: faculty });
    await expect(page.getByText('Область сотрудника изменена')).toBeVisible();

    const deanPage = await context.newPage();
    await deanPage.setViewportSize({ width: 375, height: 812 });
    await loginUi(deanPage, dean.login, password);
    await expect(deanPage.getByText(`Декан: ${faculty}`)).toBeVisible();
    await expect(deanPage.getByRole('button', { name: 'Добавить преподавателя' })).toHaveCount(0);
    await deanPage.getByRole('button', { name: 'Группы вуза', exact: true }).click();
    await expect(deanPage.getByRole('heading', { name: /E2E ИВТ/ })).toBeVisible();
    await expect(deanPage.getByRole('heading', { name: /E2E Чужая/ })).toHaveCount(0);
    await axe(deanPage);
    expect(await deanPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
  } finally {
    await context.close();
    await mine.remove();
    await other.remove();
    await page.goto('/');
    await page.getByRole('button', { name: 'Администрация', exact: true }).click();
    await page.getByRole('button', { name: `Удалить: ${dean.name}` }).click();
    await page.getByRole('button', { name: 'Удалить вход' }).click();
    await page.getByRole('button', { name: 'Факультеты', exact: true }).click();
    await page.getByRole('button', { name: `Удалить «${faculty}»` }).click();
    await expect(page.getByText(faculty)).toHaveCount(0);
  }
});
