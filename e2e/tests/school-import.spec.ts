import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginApi, loginUi, uniq } from './helpers';

const ADMIN = { login: process.env.E2E_ADMIN_LOGIN ?? 'admin', password: process.env.E2E_ADMIN_PASSWORD ?? 'admin12345' };

test('импорт школы из файла: класс демо-учителю с учениками', async ({ page, request }) => {
  const name = uniq('E2E импорт');
  const csv = ['Класс;Параллель;Учитель;ФИО', `${name};6;Анна Сергеевна;Вера Лосева`, `${name};6;;Глеб Орлов`].join('\n');
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginUi(page, ADMIN.login, ADMIN.password);
    await page.getByRole('button', { name: /^Классы школы/ }).click();
    await page.getByRole('button', { name: 'Импорт из файла' }).click();
    const dialog = page.getByRole('dialog', { name: 'Импорт из файла' });
    await dialog.getByLabel('Файл Excel или CSV').setInputFiles({ name: 'school.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await dialog.getByRole('button', { name: 'Проверить файл' }).click();
    await expect(dialog.getByRole('list', { name: 'Группы из файла' })).toContainText(`${name} (новая)Анна Сергеевна · параллель 6 · +2`);
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);

    await dialog.getByRole('button', { name: 'Импортировать' }).click();
    await expect(dialog.getByRole('status')).toContainText('Создано групп: 1, добавлено учеников: 2');
    await dialog.getByRole('button', { name: 'Готово' }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
  } finally {
    await loginApi(request);
    const groups = await (await request.get('/api/teacher/groups')).json();
    for (const g of groups.filter((x: { name: string }) => x.name === name)) {
      await request.delete(`/api/teacher/groups/${g.id}`, { headers: { 'x-heroes-client': '1' } });
    }
  }
});
