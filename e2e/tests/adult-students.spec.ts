import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { animationsDone, loginUi, TEACHER, tempGroup, uniq } from './helpers';

const ADMIN = { login: process.env.E2E_ADMIN_LOGIN ?? 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'admin12345' };
const axe = async (page: Page) => {
  await animationsDone(page);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

/** Демо-учреждение снова школа после каждого теста, даже если тест прервался по времени: стенд общий для всех тестов */
test.afterEach(async ({ playwright, baseURL }) => {
  const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { 'x-heroes-client': '1' } });
  await api.post('/api/auth/login', { data: { login: ADMIN.login, password: ADMIN.password } });
  await api.patch('/api/admin/school', { data: { kind: 'SCHOOL', heroes: true } });
  await api.dispose();
});

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

test('студент вуза переписывается с преподавателями группы', async ({ page, browser, request }) => {
  await loginUi(page, ADMIN.login, ADMIN.password);
  await setKind(page, 'Вуз');
  const g = await tempGroup(request, uniq('E2E ПИ'), ['Марк Орлов']);
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const question = uniq('E2E когда консультация');
    const student = await context.newPage();
    await student.setViewportSize({ width: 375, height: 812 });
    await loginUi(student, g.credentials[0].login, g.credentials[0].password);
    await student.getByRole('link', { name: 'Сообщения', exact: true }).click();
    await expect(student.getByRole('heading', { name: 'Сообщения', level: 1 })).toBeVisible();
    await student.getByLabel('Сообщение').fill(question);
    await student.getByRole('button', { name: 'Отправить' }).click();
    await expect(student.getByText(question)).toBeVisible();
    await axe(student);
    expect(await student.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);

    const teacher = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const tp = await teacher.newPage();
    await loginUi(tp, TEACHER.login, TEACHER.password);
    await expect(tp.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    await tp.goto('/messages');
    await tp.getByRole('link', { name: /Студент: Марк Орлов/ }).click();
    await expect(tp.getByText(question)).toBeVisible();
    await tp.getByLabel('Сообщение').fill('В четверг в 15:00');
    await tp.getByRole('button', { name: 'Отправить' }).click();
    await expect(tp.getByText('В четверг в 15:00')).toBeVisible();
    await teacher.close();

    await student.reload();
    await expect(student.getByText('В четверг в 15:00')).toBeVisible();
  } finally {
    await context.close();
    await g.remove();
    await page.goto('/');
    await setKind(page, 'Школа');
  }
});

test('без героев у студента нет конструктора и наград, а баллы остаются', async ({ page, browser, request }) => {
  await loginUi(page, ADMIN.login, ADMIN.password);
  await page.getByRole('button', { name: 'Изменить название и тип' }).click();
  await page.getByLabel('Тип учреждения').selectOption({ label: 'Вуз' });
  await page.getByRole('checkbox', { name: /Герои, питомцы, уровни и магазин наград/ }).uncheck();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Вуз', { exact: true })).toBeVisible();
  const g = await tempGroup(request, uniq('E2E без героев'), ['Ева Белова']);
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    expect((await (await request.get(`/api/teacher/groups/${g.id}`)).json()).group.heroes).toBe(false);
    const student = await context.newPage();
    await student.setViewportSize({ width: 375, height: 812 });
    await loginUi(student, g.credentials[0].login, g.credentials[0].password);
    await expect(student.getByRole('heading', { level: 1, name: 'Ева Белова' })).toBeVisible();
    await expect(student.getByRole('link', { name: 'Профиль', exact: true }).first()).toBeVisible();
    await expect(student.getByRole('link', { name: /Конструктор/ })).toHaveCount(0);
    await expect(student.getByRole('link', { name: /^Награды/ })).toHaveCount(0);
    await expect(student.getByText(/уровень:/)).toHaveCount(0);
    await expect(student.getByText('Всего', { exact: true })).toBeVisible();
    await axe(student);
    await student.screenshot({ path: test.info().outputPath('no-heroes-student.png'), fullPage: true });
  } finally {
    await context.close();
    await g.remove();
  }
});
