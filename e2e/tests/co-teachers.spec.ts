import { expect, test } from '@playwright/test';
import { TEACHER, loginUi, tempGroup, uniq } from './helpers';

const COLLEAGUE = { login: 'teacher2', password: TEACHER.password };

test('соавтор группы: приглашение, работа и выход', async ({ page, browser, request }) => {
  const groupName = uniq('E2E соавторы');
  const group = await tempGroup(request, groupName, ['Вера Лосева']);
  try {
    await test.step('создатель добавляет коллегу по логину', async () => {
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${group.id}/students`);
      await page.getByRole('button', { name: 'Настройки группы' }).click();
      await page.fill('#co-teacher-login', COLLEAGUE.login);
      await page.getByRole('dialog').getByRole('button', { name: 'Добавить', exact: true }).click();
      await expect(page.getByRole('dialog').getByText('Игорь Павлович')).toBeVisible();
    });

    await test.step('коллега видит группу, ведёт урок, но не может удалить группу', async () => {
      const colleague = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage();
      await loginUi(colleague, COLLEAGUE.login, COLLEAGUE.password);
      const card = colleague.getByRole('link', { name: new RegExp(groupName) });
      await expect(card).toContainText('Вместе с: Анна Сергеевна');
      await card.click();
      await colleague.getByRole('button', { name: /^Вера Лосева/ }).click();
      await colleague.getByRole('button', { name: /Помог другу/ }).click();
      await expect(colleague.getByRole('button', { name: /^Вера Лосева всего 1/ })).toBeVisible();

      await colleague.goto(`/g/${group.id}/students`);
      await colleague.getByRole('button', { name: 'Настройки группы' }).click();
      await expect(colleague.getByRole('button', { name: 'Удалить группу' })).toHaveCount(0);
      await colleague.getByRole('button', { name: 'Выйти из группы' }).click();
      await expect(colleague.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await expect(colleague.getByRole('link', { name: new RegExp(groupName) })).toHaveCount(0);
      await colleague.context().close();
    });
  } finally {
    await group.remove();
  }
});
