import { expect, test } from '@playwright/test';
import { TEACHER, loginUi, tempGroup, uniq } from './helpers';

const H = { 'x-heroes-client': '1' };

test('магазин наград и командный режим', async ({ page, browser, request }) => {
  const group = await tempGroup(request, uniq('E2E награды'), ['Лиза Ершова', 'Кирилл Носов', 'Дина Пак', 'Олег Сом']);
  const liza = group.credentials.find((c) => c.name === 'Лиза Ершова')!;
  const details = await (await request.get(`/api/teacher/groups/${group.id}`)).json();
  const plus2 = details.reasons.find((r: { value: number }) => r.value === 2);
  for (let i = 0; i < 8; i++) {
    await request.post(`/api/teacher/groups/${group.id}/points`, { headers: H, data: { studentIds: [liza.id], reasonId: plus2.id } });
  }
  try {
    const student = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage();
    await test.step('ученик просит награду на свои баллы', async () => {
      await loginUi(student, liza.login, liza.password);
      await student.getByRole('link', { name: 'Награды' }).first().click();
      await expect(student.getByText('можно потратить')).toBeVisible();
      const seat = student.locator('li', { hasText: 'Выбрать место на уроке' });
      await seat.getByRole('button', { name: 'Попросить' }).click();
      await expect(student.getByText('ждёт ответа учителя')).toBeVisible();
      await expect(student.locator('.font-display', { hasText: /^1$/ })).toBeVisible();
    });

    await test.step('преподаватель выдаёт награду', async () => {
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${group.id}/rewards`);
      await expect(page.getByRole('link', { name: /Награды.*1 запрос/ })).toBeVisible();
      await page.locator('li', { hasText: 'Лиза Ершова' }).getByRole('button', { name: 'Выдать' }).click();
      await expect(page.getByText('Новых запросов нет')).toBeVisible();
      await student.reload();
      await expect(student.getByText('получено')).toBeVisible();
      await student.context().close();
    });

    await test.step('команды: создать, распределить, начислить команде', async () => {
      await page.goto(`/g/${group.id}`);
      await page.getByRole('button', { name: 'Команды' }).click();
      const dialog = page.getByRole('dialog', { name: 'Команды' });
      for (const [i, name] of ['Кометы', 'Ракеты'].entries()) {
        await dialog.locator('#new-team').fill(name);
        await dialog.getByRole('button', { name: 'Добавить', exact: true }).click();
        await expect(dialog.getByRole('textbox', { name: 'Название команды' })).toHaveCount(i + 1);
      }
      await dialog.getByRole('button', { name: 'Распределить поровну случайно' }).click();
      await dialog.getByRole('button', { name: 'Сохранить состав' }).click();
      const comets = page.getByRole('region', { name: 'Команда Кометы' });
      await expect(comets).toBeVisible();
      await expect(comets.getByRole('button', { name: /всего/ })).toHaveCount(2);
      // Состав случайный: счёт сравниваем с самим собой, а лидер ровно один
      const score = comets.locator('.chip', { hasText: 'сегодня' });
      const before = await score.textContent();
      await comets.getByRole('button', { name: 'Начислить команде' }).click();
      await page.getByRole('dialog', { name: 'Команда «Кометы»' }).getByRole('button', { name: /Командная работа/ }).click();
      await expect(score).not.toHaveText(before!);
      await expect(page.getByText('лидер', { exact: true })).toHaveCount(1);
    });
  } finally {
    await group.remove();
  }
});
