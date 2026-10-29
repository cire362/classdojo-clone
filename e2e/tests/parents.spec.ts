import { expect, test } from '@playwright/test';
import { TEACHER, loginUi, tempGroup, uniq } from './helpers';

test('родители: лист для собрания и кабинет родителя', async ({ page, browser, request }) => {
  const group = await tempGroup(request, uniq('E2E родители'), ['Алина Орлова', 'Глеб Орлов']);
  try {
    let creds: string[] = [];
    await test.step('преподаватель выдаёт входы всей группе и печатает лист', async () => {
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${group.id}/students`);
      await page.getByRole('button', { name: 'Входы родителям' }).click();
      await page.getByRole('button', { name: 'Создать и распечатать' }).click();
      await expect(page.getByRole('heading', { name: 'Лист для родителей' })).toBeVisible();
      const card = page.locator('.print-card', { hasText: 'Алина Орлова' });
      creds = await card.locator('dd').allTextContents();
      expect(creds[1]).toMatch(/^parent\.alina\.o/);
    });

    await test.step('родитель видит своего ребёнка и только его', async () => {
      const parent = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage();
      await loginUi(parent, creds[1], creds[2]);
      await expect(parent.getByText('Родитель: Алина Орлова')).toBeVisible();
      await expect(parent.getByText(/Алина Орлова,/)).toBeVisible();
      await expect(parent.getByText('Глеб Орлов')).toHaveCount(0);
      // Никаких действий преподавателя или ученика
      await expect(parent.getByRole('link', { name: 'Собрать героя' })).toHaveCount(0);
      await parent.context().close();
    });

    await test.step('общий вход для брата: привязка в карточке ученика', async () => {
      const glebId = group.credentials.find((c) => c.name === 'Глеб Орлов')!.id;
      await page.goto(`/s/${glebId}`);
      // Глебу уже выдан свой вход — привязываем ещё и вход Алины
      await page.getByRole('button', { name: 'Общий вход с братом или сестрой' }).click();
      await page.fill('#parent-login', creds[1]);
      await page.getByRole('button', { name: 'Привязать' }).click();
      await expect(page.getByText('Также: Алина Орлова')).toBeVisible();

      const parent = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage();
      await loginUi(parent, creds[1], creds[2]);
      await expect(parent.getByRole('tab', { name: /Глеб Орлов/ })).toBeVisible();
      await parent.getByRole('tab', { name: /Глеб Орлов/ }).click();
      await expect(parent.getByText(/Глеб Орлов,/)).toBeVisible();
      await parent.context().close();
    });
  } finally {
    await group.remove();
  }
});
