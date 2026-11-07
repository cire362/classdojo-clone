import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loginUi } from './helpers';

const ADMIN = { login: process.env.E2E_ADMIN_LOGIN ?? 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'admin12345' };
const axe = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};
const narrow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);

for (const colorScheme of ['light', 'dark'] as const) {
  test(`преподаватель подключается по коду школы, директор подтверждает заявку (${colorScheme})`, async ({ page, browser }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await loginUi(page, ADMIN.login, ADMIN.password);
    const join = page.getByRole('region', { name: 'Подключение преподавателей' });
    await expect(join.getByRole('button', { name: /^(Новый код|Включить код подключения)$/ })).toBeVisible();
    const hadCode = await join.getByText('Код подключения к школе', { exact: true }).isVisible();
    await join.getByRole('button', { name: hadCode ? 'Новый код' : 'Включить код подключения' }).click();
    const code = (await join.locator('.font-mono.text-2xl').innerText()).trim();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    await axe(page);

    const teacherContext = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme, reducedMotion: 'reduce' });
    const teacher = await teacherContext.newPage();
    try {
      await teacher.setViewportSize({ width: 375, height: 812 });
      await teacher.goto('/login');
      await teacher.getByRole('link', { name: 'Я преподаватель, у меня код подключения' }).click();
      await teacher.getByLabel('Код подключения').fill(code.toLowerCase());
      await teacher.getByRole('button', { name: 'Дальше' }).click();
      const login = `e2e.join.${Date.now().toString(36)}`;
      const name = `E2E Заявка ${colorScheme}`;
      await teacher.getByLabel('Как вас называть ученикам').fill(name);
      await teacher.getByLabel('Логин').fill(login);
      await teacher.getByLabel('Пароль', { exact: true }).fill('join-pass-123');
      await teacher.getByLabel('Пароль ещё раз').fill('join-pass-123');
      await axe(teacher);
      await narrow(teacher);
      await teacher.getByRole('button', { name: 'Отправить заявку' }).click();
      await expect(teacher.getByRole('heading', { name: 'Заявка отправлена' })).toBeVisible();
      await axe(teacher);
      await teacher.screenshot({ path: test.info().outputPath(`school-join-sent-${colorScheme}.png`), fullPage: true });

      await teacher.getByRole('link', { name: 'Ко входу' }).click();
      await loginUi(teacher, login, 'join-pass-123');
      await expect(teacher.getByRole('alert')).toContainText('ещё ждёт проверки');

      await page.reload();
      const requests = page.getByRole('list', { name: 'Заявки преподавателей' });
      await expect(requests.getByText(name)).toBeVisible();
      await expect(page.getByRole('button', { name: /Преподаватели.*ждут проверки/ })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`school-requests-${colorScheme}.png`), fullPage: true });
      await requests.getByRole('button', { name: `Подтвердить: ${name}` }).click();
      await expect(page.getByText(`${name} может войти`)).toBeVisible();
      await expect(page.getByRole('main').getByRole('heading', { name, level: 3 })).toBeVisible();

      await loginUi(teacher, login, 'join-pass-123');
      await expect(teacher.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    } finally {
      await teacherContext.close();
      // Код школы возвращается в исходное состояние: стенд общий для всех тестов
      if (!hadCode) await join.getByRole('button', { name: 'Выключить' }).click();
    }
  });
}

test('директор добавляет сотрудника: тот видит школу, но ничего не меняет; затем вход удаляется', async ({ page, browser }) => {
  await loginUi(page, ADMIN.login, ADMIN.password);
  await page.getByRole('button', { name: 'Администрация', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить сотрудника' }).click();
  const login = `e2e.staff.${Date.now().toString(36)}`;
  const name = 'E2E Секретарь';
  await page.getByLabel('Имя сотрудника').fill(name);
  await page.getByLabel('Логин').fill(login);
  await page.getByLabel('Должность', { exact: true }).selectOption('STAFF');
  await page.getByRole('button', { name: 'Создать вход' }).click();
  const issued = page.getByRole('dialog', { name: 'Передайте данные сотруднику' });
  const password = await issued.locator('dd').nth(1).innerText();
  await page.getByRole('button', { name: 'Данные сохранены, закрыть' }).click();

  const clerkContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const clerk = await clerkContext.newPage();
  try {
    await clerk.setViewportSize({ width: 375, height: 812 });
    await loginUi(clerk, login, password);
    await expect(clerk.getByRole('main').getByText('Сотрудник', { exact: true })).toBeVisible();
    await expect(clerk.getByRole('heading', { name: /Преподаватели/ })).toBeVisible();
    await expect(clerk.getByRole('button', { name: 'Добавить преподавателя' })).toHaveCount(0);
    await expect(clerk.getByRole('button', { name: 'Переименовать школу' })).toHaveCount(0);
    await axe(clerk);
    await narrow(clerk);
    expect((await clerk.request.post('/api/admin/join-code', { headers: { 'x-heroes-client': '1' } })).status()).toBe(403);

    await page.getByRole('button', { name: `Удалить: ${name}` }).click();
    await page.getByRole('button', { name: 'Удалить вход' }).click();
    await expect(page.getByText(login)).toHaveCount(0);
    await clerk.reload();
    await expect(clerk.getByRole('heading', { name: 'Вход', exact: true })).toBeVisible();
  } finally {
    await clerkContext.close();
  }
});
