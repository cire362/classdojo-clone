import { AxeBuilder } from '@axe-core/playwright';
import { expect, request, test, type Page } from '@playwright/test';
import { animationsDone, loginUi, TEACHER, tempGroup, uniq } from './helpers';

const ADMIN = { login: process.env.E2E_ADMIN_LOGIN ?? 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'admin12345' };
const axe = async (page: Page) => {
  await animationsDone(page);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

/** Тип демо-учреждения меняется на время теста; после — снова школа, даже если тест прервался */
const setKind = async (playwright: { request: { newContext: typeof request.newContext } }, baseURL: string | undefined, kind: string) => {
  const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { 'x-heroes-client': '1' } });
  await api.post('/api/auth/login', { data: { login: ADMIN.login, password: ADMIN.password } });
  await api.patch('/api/admin/school', { data: { kind, heroes: true } });
  await api.dispose();
};
test.afterEach(async ({ playwright, baseURL }) => setKind(playwright, baseURL, 'SCHOOL'));

test('поток колледжа: лекция у двух групп, баллы всему потоку и отметка посещаемости', async ({ page, request, playwright, baseURL }) => {
  await setKind(playwright, baseURL, 'COLLEGE');
  const stream = uniq('E2E Лекция');
  const first = await tempGroup(request, uniq('E2E ИС-21'), ['Вера Лосева']);
  const second = await tempGroup(request, uniq('E2E ИС-22'), ['Глеб Орлов']);
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginUi(page, TEACHER.login, TEACHER.password);
    await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    await page.getByRole('button', { name: 'Новый поток' }).click();
    const dialog = page.getByRole('dialog', { name: 'Новый поток' });
    await dialog.getByLabel('Название').fill(stream);
    await dialog.getByLabel(/E2E ИС-21/).check();
    await dialog.getByLabel(/E2E ИС-22/).check();
    await dialog.getByRole('button', { name: 'Сохранить' }).click();
    await page.getByRole('link', { name: new RegExp(stream) }).click();

    await expect(page.getByRole('heading', { name: stream })).toBeVisible();
    await page.getByRole('button', { name: 'Всему потоку' }).click();
    await page.getByRole('dialog', { name: 'Весь поток' }).getByRole('button', { name: /Помощь одногруппнику/ }).click();
    await expect(page.getByText('Весь поток: +1, помощь одногруппнику')).toBeVisible();
    await expect(page.getByText('всего 1')).toHaveCount(2);
    await axe(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);

    await page.getByRole('button', { name: 'Посещаемость' }).click();
    await expect(page.getByText('Занятие ещё не отмечено')).toBeVisible();
    await page.getByLabel('Глеб Орлов').check();
    await page.getByRole('button', { name: 'Сохранить отметку' }).click();
    await expect(page.getByText('Отмечено: 1 из 2')).toBeVisible();
    await expect(page.getByText('Уже отмечено в 2 из 2 групп')).toBeVisible();
    await axe(page);

    // Отметка записалась в группу, как обычная
    const day = await (await request.get(`/api/teacher/groups/${second.id}/attendance`)).json();
    expect(day.session.presentStudentIds).toEqual([second.credentials[0].id]);
  } finally {
    const list = await (await request.get('/api/teacher/streams')).json();
    for (const s of list.filter((x: { name: string }) => x.name === stream)) {
      await request.delete(`/api/teacher/streams/${s.id}`, { headers: { 'x-heroes-client': '1' } });
    }
    await first.remove();
    await second.remove();
  }
});
