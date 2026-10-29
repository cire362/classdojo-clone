import { expect, test } from '@playwright/test';
import { TEACHER, loginUi, tempGroup, uniq } from './helpers';

const H = { 'x-heroes-client': '1' };

test('лента класса и переписка родителя с преподавателем', async ({ page, browser, request }) => {
  const group = await tempGroup(request, uniq('E2E лента'), ['Ева Лебедева']);
  const eva = group.credentials[0];
  const parentCreds = await (await request.post(`/api/teacher/students/${eva.id}/parents`, { headers: H })).json();
  try {
    await test.step('преподаватель публикует объявление', async () => {
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${group.id}/feed`);
      await page.fill('#post-text', 'В пятницу урок в 15:00');
      await page.getByRole('button', { name: 'Опубликовать' }).click();
      await expect(page.getByText('В пятницу урок в 15:00')).toBeVisible();
    });

    const parent = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage();
    await test.step('родитель видит значок, читает ленту и пишет преподавателю', async () => {
      await loginUi(parent, parentCreds.login, parentCreds.password);
      await expect(parent.getByRole('button', { name: /Лента класса.*1.*новых/ })).toBeVisible();
      await parent.getByRole('button', { name: /Лента класса/ }).click();
      await expect(parent.getByText('В пятницу урок в 15:00')).toBeVisible();
      await expect(parent.getByRole('button', { name: /Лента класса.*новых/ })).toHaveCount(0);

      await parent.getByRole('button', { name: /Сообщения/ }).click();
      await parent.fill('#message-text', 'Ева будет на уроке, спасибо!');
      await parent.getByRole('button', { name: 'Отправить' }).click();
      await expect(parent.getByText('Ева будет на уроке, спасибо!')).toBeVisible();
    });

    await test.step('преподаватель видит новое сообщение и отвечает', async () => {
      await page.goto('/');
      await expect(page.getByRole('link', { name: /Сообщения.*новых сообщений/ })).toBeVisible();
      await page.getByRole('link', { name: /Сообщения/ }).click();
      await page.getByRole('link', { name: /Родители: Ева Лебедева/ }).click();
      await expect(page.getByText('Ева будет на уроке, спасибо!')).toBeVisible();
      await page.fill('#message-text', 'Ждём!');
      await page.getByRole('button', { name: 'Отправить' }).click();
      await expect(page.getByText('Ждём!')).toBeVisible();

      await parent.reload();
      await parent.getByRole('button', { name: /Сообщения/ }).click();
      await expect(parent.getByText('Ждём!')).toBeVisible();
      await parent.context().close();
    });
  } finally {
    await group.remove();
  }
});
