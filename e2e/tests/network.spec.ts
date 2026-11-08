import { expect, test } from '@playwright/test';
import { IMAGES, TEACHER, loginUi, tempGroup, uniq } from './helpers';

test.describe('отметка по фото при плохом интернете', () => {
  test('обрывы связи и офлайн: фото всё равно доходит', async ({ page, context, request }) => {
    const g = await tempGroup(request, uniq('E2E сеть'), ['Сеть Первый', 'Сеть Второй']);
    try {
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();

      // Два обрыва подряд, третья попытка успешна
      await page.goto(`/g/${g.id}/attendance`);
      let fails = 2;
      await page.route('**/attendance/detect', (r) => (fails-- > 0 ? r.abort('connectionreset') : r.continue()));
      await page.locator('input[type=file]').nth(1).setInputFiles(`${IMAGES}crew_4_people.jpg`);
      await expect(page.getByText(/Пробуем ещё раз/)).toBeVisible();
      await expect(page.getByText('На фото 4 человека')).toBeVisible({ timeout: 30_000 });
      await page.unroute('**/attendance/detect');

      // Без интернета ждём связь и отправляем сами
      await page.goto(`/g/${g.id}/attendance`);
      await expect(page.getByText('День урока')).toBeVisible();
      await context.setOffline(true);
      await page.locator('input[type=file]').nth(1).setInputFiles(`${IMAGES}crew_4_people.jpg`);
      await expect(page.getByText(/Нет интернета/)).toBeVisible();
      await context.setOffline(false);
      await expect(page.getByText('На фото 4 человека')).toBeVisible({ timeout: 30_000 });
    } finally {
      await context.setOffline(false);
      await g.remove();
    }
  });

  test('после входа вкладки открываются и без интернета', async ({ page, context, request }) => {
    const g = await tempGroup(request, uniq('E2E офлайн'), ['Офлайн Первый']);
    try {
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${g.id}`);
      await expect(page.getByRole('button', { name: /^Офлайн Первый/ })).toBeVisible();
      // Ждём, пока фоновая подгрузка страниц (стартует через ~3 с после загрузки) действительно закончится
      await page.waitForFunction(
        () => ['Reasons', 'Students', 'Stats', 'Attendance'].every((n) =>
          performance.getEntriesByType('resource').some((e) => e.name.includes(`/assets/${n}-`)),
        ),
        undefined,
        { timeout: 20_000 },
      );
      await page.waitForLoadState('networkidle');
      await context.setOffline(true);
      for (const [tab, marker] of [
        ['Причины', 'Причины начисления'],
        ['Ученики', 'Добавить учеников'],
        ['Статистика', 'Скачать Excel'],
        ['Отметка', 'День урока'],
      ] as const) {
        await page.getByRole('link', { name: tab }).click();
        await expect(page.getByText(marker).first(), tab).toBeVisible();
        await expect(page.getByText('Не удалось загрузить страницу')).toHaveCount(0);
      }
    } finally {
      await context.setOffline(false);
      await g.remove();
    }
  });
});

test('приложение ставится на телефон и открывается без интернета', async ({ page, context }) => {
  await loginUi(page, TEACHER.login, TEACHER.password);
  const home = page.getByRole('heading', { name: /Здравствуйте/ });
  await expect(home).toBeVisible();

  // Манифест для установки
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Герои класса', display: 'standalone' });

  // Service worker берёт страницу под управление; код страниц ложится в кэш
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect(home).toBeVisible();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // Без интернета: оболочка приложения открывается и честно говорит про связь, вход не сбрасывается
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Нет связи с сервером')).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(home).toBeVisible();
});
