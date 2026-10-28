import { expect, test, type Page } from '@playwright/test';
import { TEACHER, loginUi, tempGroup, uniq } from './helpers';

/** Интерфейс на телефоне 375 px: страницы не должны прокручиваться по горизонтали */
async function noHorizontalScroll(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll, `${path}: ширина ${scroll} > ${width}`).toBeLessThanOrEqual(width + 1);
}

test('страницы помещаются в 375 px', async ({ page, request, browser }) => {
  const g = await tempGroup(request, uniq('E2E телефон'), ['Мобильный Первый', 'Мобильный Второй', 'Мобильный Третий']);
  try {
    await loginUi(page, TEACHER.login, TEACHER.password);
    await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    for (const path of ['/', `/g/${g.id}`, `/g/${g.id}/attendance`, `/g/${g.id}/students`, `/g/${g.id}/reasons`, `/g/${g.id}/stats`, '/settings']) {
      await noHorizontalScroll(page, path);
    }
    const s = g.credentials[0];
    const student = await (await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 375, height: 812 } })).newPage();
    await loginUi(student, s.login, s.password);
    await expect(student.getByRole('link', { name: 'Собрать героя' })).toBeVisible();
    for (const path of ['/', '/hero']) await noHorizontalScroll(student, path);
    await student.context().close();
  } finally {
    await g.remove();
  }
});
