import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { IMAGES, TEACHER, loginUi, tempGroup, uniq } from './helpers';

const PHOTO = { name: 'решение.jpg', mimeType: 'image/jpeg', buffer: readFileSync(`${IMAGES}crew_4_people.jpg`) };
const axe = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};
const twoDaysLater = () => {
  const d = new Date(Date.now() + 2 * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

for (const colorScheme of ['light', 'dark'] as const) {
  test(`задания: выдача, ответ ученика с фото, приём с баллами (${colorScheme})`, async ({ page, browser, request }) => {
    const g = await tempGroup(request, uniq('E2E задания'), ['Лиза Ершова', 'Марк Орлов']);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${g.id}/assignments`);
      await page.getByRole('button', { name: 'Новое задание' }).click();
      await page.getByLabel('Что сделать').fill('Решить задачи 1–5');
      await page.getByLabel('Подробности, если нужны').fill('Учебник, страница 42');
      await page.getByLabel('Сдать до').fill(twoDaysLater());
      await page.getByLabel('Баллы за выполнение').selectOption('2');
      await axe(page);
      await page.getByRole('button', { name: 'Выдать задание' }).click();
      await expect(page.getByRole('link', { name: /Решить задачи 1–5/ })).toContainText('Сдали 0 из 2');

      const pupilContext = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme, reducedMotion: 'reduce' });
      const pupil = await pupilContext.newPage();
      await pupil.setViewportSize({ width: 375, height: 812 });
      await loginUi(pupil, g.credentials[0].login, g.credentials[0].password);
      await pupil.getByRole('link', { name: /^Задания.*1/ }).click();
      const task = pupil.getByRole('listitem').filter({ has: pupil.getByRole('heading', { name: 'Решить задачи 1–5' }) });
      await expect(task.getByText('Новое')).toBeVisible();
      await expect(task.getByText('2 балла за выполнение')).toBeVisible();
      await task.getByLabel('Текст ответа, если нужен').fill('Ответы: 12, 7, 3, 9, 1');
      await task.locator('input[type=file]').setInputFiles([PHOTO]);
      await axe(pupil);
      await task.getByRole('button', { name: 'Сдать ответ' }).click();
      await expect(task.getByText('На проверке').first()).toBeVisible();
      expect(await pupil.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      const before = (await (await pupil.request.get('/api/student/profile')).json()).points.total.net;

      await page.reload();
      await page.getByRole('link', { name: /Задания.*1 ответ ждёт проверки/ }).click();
      await page.getByRole('link', { name: /Решить задачи 1–5/ }).click();
      await expect(page.getByText('Ответа нет')).toBeVisible();
      await page.getByLabel('Комментарий ученику').fill('Всё верно!');
      await axe(page);
      await page.getByRole('button', { name: 'Принять' }).click();
      await expect(page.getByText('Ответ принят: Лиза Ершова')).toBeVisible();
      await expect(page.getByRole('link', { name: /ждёт проверки/ })).toHaveCount(0);
      await page.screenshot({ path: test.info().outputPath(`assignment-review-${colorScheme}.png`), fullPage: true });

      await pupil.reload();
      await expect(task.getByText('Принято')).toBeVisible();
      expect((await (await pupil.request.get('/api/student/profile')).json()).points.total.net).toBe(before + 2);
      await task.getByRole('button', { name: 'Подробнее: Решить задачи 1–5' }).click();
      await expect(task.getByText('Всё верно!')).toBeVisible();
      await axe(pupil);
      await pupilContext.close();
    } finally {
      await g.remove();
    }
  });
}
