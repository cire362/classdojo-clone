import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { IMAGES, TEACHER, loginApi, loginUi, uniq } from './helpers';

/**
 * Главный сценарий из задания: создать группу → добавить учеников → распечатать логины →
 * отметить по фото → начислить баллы → статистика → Excel; затем ученик собирает героя.
 */
test('сценарий преподавателя и ученика', async ({ page, browser, request }) => {
  const groupName = uniq('E2E группа');
  let groupId = '';
  try {
    await test.step('вход и создание группы', async () => {
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.fill('#group-name', groupName);
      await page.getByRole('button', { name: 'Создать' }).click();
      await expect(page.getByRole('heading', { name: groupName })).toBeVisible();
      groupId = page.url().split('/g/')[1].split('/')[0];
    });

    let creds: string[][] = [];
    await test.step('добавление учеников и печать логинов', async () => {
      await page.fill('#names', 'Соня Белова\nТимур Ахметов\nНика Зайцева\nЛев Крылов\nМира Седова');
      await page.getByRole('button', { name: 'Добавить 5' }).click();
      await expect(page.getByText('Пароли показываются только сейчас')).toBeVisible();
      creds = await page.$$eval('[role=dialog] table tbody tr', (rows) =>
        rows.map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent ?? '')),
      );
      expect(creds).toHaveLength(5);
      await page.getByRole('button', { name: 'Распечатать' }).click();
      await expect(page.locator('.print-card')).toHaveCount(5);
      await expect(page.locator('.print-card').first()).toContainText(creds.find((c) => c[0] === 'Лев Крылов')![2]);
    });

    await test.step('отметка по фото', async () => {
      await page.goto(`/g/${groupId}/attendance`);
      await page.locator('input[type=file]').nth(1).setInputFiles(`${IMAGES}crew_4_people.jpg`);
      await expect(page.getByText('На фото 4 человека')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole('heading', { name: 'Отмечено 5 из 5' })).toBeVisible();
      // Двоих нет: снимаем отметки, расхождение с фото пропадает (4 на фото минус преподаватель = 3)
      await page.locator('ul.card label', { hasText: 'Лев Крылов' }).click();
      await page.locator('ul.card label', { hasText: 'Мира Седова' }).click();
      await expect(page.getByRole('heading', { name: 'Отмечено 3 из 5' })).toBeVisible();
      await expect(page.getByText(/а отмечено/)).toHaveCount(0);
      await page.getByRole('button', { name: 'Сохранить' }).click();
      await expect(page.getByText('Посещаемость сохранена')).toBeVisible();
    });

    await test.step('начисление и списание баллов', async () => {
      await page.getByRole('link', { name: 'К уроку' }).click();
      await page.getByRole('button', { name: /^Соня Белова/ }).click();
      await page.getByRole('button', { name: /Отличная работа/ }).click();
      await expect(page.getByText('Соня: +2, отличная работа')).toBeVisible();
      await page.getByRole('button', { name: 'Несколько' }).click();
      await page.getByRole('button', { name: /^Тимур Ахметов/ }).click();
      await page.getByRole('button', { name: /^Ника Зайцева/ }).click();
      await page.getByRole('button', { name: 'Начислить' }).click();
      await page.getByRole('button', { name: /Опоздал/ }).click();
      // Минусы на общем экране не показываются
      await expect(page.getByText('Записано')).toBeVisible();
      await expect(page.getByRole('button', { name: /^Соня Белова всего 3/ })).toBeVisible();
    });

    await test.step('статистика и Excel', async () => {
      await page.getByRole('link', { name: 'Статистика' }).click();
      const row = page.locator('tr', { hasText: 'Тимур Ахметов' });
      await expect(row).toContainText('+1');
      await expect(row).toContainText('−1');
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Скачать Excel' }).click()]);
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
      const bytes = readFileSync((await download.path())!);
      expect(bytes.subarray(0, 2).toString()).toBe('PK');
    });

    await test.step('ученик входит, собирает героя, видит историю', async () => {
      const [name, login, password] = creds.find((c) => c[0] === 'Соня Белова')!;
      const student = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage();
      await loginUi(student, login, password);
      await expect(student.getByText(`${name}, ${groupName}`)).toBeVisible();
      await expect(student.getByText('Отличная работа')).toBeVisible();
      await student.getByRole('link', { name: 'Собрать героя' }).click();
      await student.fill('#hero-name', 'Звёздная Соня');
      await student.getByRole('button', { name: 'Сохранить героя' }).click();
      await expect(student.getByText('Герой сохранён')).toBeVisible();
      await student.getByRole('link', { name: 'Мой герой' }).first().click();
      await expect(student.getByRole('heading', { name: 'Звёздная Соня' })).toBeVisible();
      await student.context().close();
    });
  } finally {
    if (groupId) {
      await loginApi(request);
      await request.delete(`/api/teacher/groups/${groupId}`, { headers: { 'x-heroes-client': '1' } });
    }
  }
});
