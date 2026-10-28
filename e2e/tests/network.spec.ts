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
});
