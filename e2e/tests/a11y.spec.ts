import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { TEACHER, loginUi, tempGroup, uniq } from './helpers';

/**
 * Доступность: автоматическая проверка axe (WCAG 2.1 A/AA и рекомендации) на ключевых экранах
 * в светлой и тёмной теме, плюс работа с клавиатуры в окнах.
 */
async function expectNoViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
  const summary = violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join('; ')})`);
  expect(summary, label).toEqual([]);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`экраны без нарушений доступности (${colorScheme === 'light' ? 'светлая' : 'тёмная'} тема)`, async ({ browser, request }) => {
    const g = await tempGroup(request, uniq('E2E доступность'), ['Доступ Первый', 'Доступ Второй']);
    const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme });
    const page = await ctx.newPage();
    try {
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Вход в класс' })).toBeVisible();
      await expectNoViolations(page, 'вход');

      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await expectNoViolations(page, 'группы');
      for (const [path, marker] of [
        [`/g/${g.id}`, 'Всей группе'],
        [`/g/${g.id}/attendance`, 'День урока'],
        [`/g/${g.id}/students`, 'Добавить учеников'],
        [`/g/${g.id}/reasons`, 'Причины начисления'],
        [`/g/${g.id}/stats`, 'Скачать Excel'],
        ['/settings', 'Сменить пароль'],
      ] as const) {
        await page.goto(path);
        await expect(page.getByText(marker).first()).toBeVisible();
        await expectNoViolations(page, path);
      }
      await page.goto(`/g/${g.id}`);
      await page.getByRole('button', { name: 'Всей группе' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      // Ждём конца анимации появления: полупрозрачный текст axe посчитал бы неконтрастным
      await page.waitForFunction(() => {
        const d = document.querySelector('[role=dialog]');
        return !!d && getComputedStyle(d).opacity === '1' && getComputedStyle(d.parentElement!).opacity === '1';
      });
      await expectNoViolations(page, 'окно причин');

      const s = g.credentials[0];
      const student = await ctx.browser()!.newContext({ baseURL: test.info().project.use.baseURL, colorScheme });
      const sp = await student.newPage();
      await loginUi(sp, s.login, s.password);
      await expect(sp.getByRole('link', { name: 'Собрать героя' })).toBeVisible();
      await expectNoViolations(sp, 'кабинет');
      await sp.goto('/hero');
      await expect(sp.getByRole('heading', { name: 'Конструктор героя' })).toBeVisible();
      await expectNoViolations(sp, 'конструктор');
      await student.close();

      // Кабинет родителя с двумя детьми (переключатель)
      const issued = await (await page.request.post(`/api/teacher/students/${g.credentials[0].id}/parents`, { headers: { 'x-heroes-client': '1' } })).json();
      await page.request.post(`/api/teacher/students/${g.credentials[1].id}/parents/link`, {
        headers: { 'x-heroes-client': '1' },
        data: { login: issued.login },
      });
      const parent = await ctx.browser()!.newContext({ baseURL: test.info().project.use.baseURL, colorScheme });
      const pp = await parent.newPage();
      await loginUi(pp, issued.login, issued.password);
      await expect(pp.getByRole('tab', { name: /Доступ Второй/ })).toBeVisible();
      await expect(pp.getByText(/^Доступ Второй, E2E/)).toBeVisible();
      await expectNoViolations(pp, 'кабинет родителя');
      await parent.close();
    } finally {
      await ctx.close();
      await g.remove();
    }
  });
}

test('окно работает с клавиатуры: фокус внутри, Esc закрывает, фокус возвращается', async ({ page, request }) => {
  const g = await tempGroup(request, uniq('E2E клавиатура'), ['Клава Первая']);
  try {
    await loginUi(page, TEACHER.login, TEACHER.password);
    await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    await page.goto(`/g/${g.id}`);
    const card = page.getByRole('button', { name: /^Клава Первая/ });
    await card.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Клава Первая' });
    await expect(dialog).toBeVisible();
    // Tab много раз — фокус не уходит из окна
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(card).toBeFocused();
  } finally {
    await g.remove();
  }
});
