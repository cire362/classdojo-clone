import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { TEACHER, loginUi, tempGroup, uniq } from './helpers';

const ADMIN = { login: process.env.E2E_ADMIN_LOGIN ?? 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'admin12345' };
const H = { 'x-heroes-client': '1' };
const axe = async (page: Page) => {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

for (const colorScheme of ['light', 'dark'] as const) {
  test(`баллы школы: общая причина, цель всех классов и рейтинг (${colorScheme})`, async ({ page, browser, request }) => {
    const reasonName = uniq('E2E Дежурство');
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await loginUi(page, ADMIN.login, ADMIN.password);
    await page.getByRole('button', { name: 'Баллы школы', exact: true }).click();
    const goalButton = page.getByRole('button', { name: /Задать цель школы|Изменить/ }).first();
    await goalButton.click();
    await page.getByLabel('Что сделаем всей школой?').fill('Школьный пикник');
    await page.getByLabel('Сколько баллов собрать всем классам?').fill('1000');
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('heading', { name: 'Цель школы: Школьный пикник' })).toBeVisible();
    await page.getByRole('button', { name: /Добавить причину/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Новая общая причина' });
    await dialog.getByLabel('Название').fill(reasonName);
    await dialog.getByLabel('Баллы').selectOption('2');
    await dialog.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('list', { name: 'Общие причины школы' }).getByText(reasonName)).toBeVisible();
    await axe(page);

    const g = await tempGroup(request, uniq('E2E баллы школы'), ['Лиза Ершова', 'Марк Орлов']);
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme, reducedMotion: 'reduce' });
    try {
      const reasons = await (await request.get(`/api/teacher/groups/${g.id}/reasons`)).json();
      const copy = reasons.find((r: { name: string }) => r.name === reasonName);
      expect(copy).toMatchObject({ school: true, value: 2 });
      const students = g.credentials.map((c) => c.id);
      const data = { reasonId: copy.id, studentIds: students };
      expect((await request.post(`/api/teacher/groups/${g.id}/points`, { data, headers: H })).ok()).toBe(true);

      const teacher = await context.newPage();
      await loginUi(teacher, TEACHER.login, TEACHER.password);
      await expect(teacher.getByText(/Все классы собрали \d+ из 1000 баллов/)).toBeVisible();
      const mine = teacher.getByRole('list', { name: 'Места классов' }).getByRole('listitem').filter({ hasText: 'E2E баллы школы' });
      await expect(mine.getByText('Ваш класс')).toBeVisible();
      await expect(mine).toContainText('2 на ученика');
      await axe(teacher);
      await teacher.goto(`/g/${g.id}/reasons`);
      const row = teacher.getByRole('listitem').filter({ hasText: reasonName });
      await expect(row.getByText('Школа')).toBeVisible();
      await expect(row.getByRole('button', { name: /Изменить/ })).toHaveCount(0);

      const pupil = await context.newPage();
      await context.clearCookies();
      await pupil.setViewportSize({ width: 375, height: 812 });
      await loginUi(pupil, g.credentials[0].login, g.credentials[0].password);
      await expect(pupil.getByRole('heading', { name: 'Цель школы: Школьный пикник' })).toBeVisible();
      await axe(pupil);
      expect(await pupil.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await pupil.screenshot({ path: test.info().outputPath(`school-goal-student-${colorScheme}.png`), fullPage: true });
    } finally {
      await context.close();
      await g.remove();
      // Цель и причина убираются: стенд общий для всех тестов
      await page.reload();
      await page.getByRole('button', { name: 'Баллы школы', exact: true }).click();
      await page.getByRole('button', { name: `Удалить «${reasonName}»` }).click();
      await page.getByRole('button', { name: 'Убрать', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Убрать цель' }).click();
      await expect(page.getByRole('button', { name: /Задать цель школы/ })).toBeVisible();
    }
  });
}
