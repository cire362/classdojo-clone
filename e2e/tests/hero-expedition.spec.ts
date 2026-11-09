import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { animationsDone, loginUi, tempGroup, uniq } from './helpers';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`новые герои: примерка, сохранение, уровни и телефон (${colorScheme})`, async ({ page, request }) => {
    const g = await tempGroup(request, uniq('E2E искатели'), ['Мира Искатель']);
    const H = { 'x-heroes-client': '1' };
    try {
      const reason = await request.post(`/api/teacher/groups/${g.id}/reasons`, {
        headers: H, data: { name: 'Проект', value: 10, emoji: 'star' },
      });
      expect(reason.ok()).toBeTruthy();
      const reasonId = (await reason.json()).id;
      expect((await request.post(`/api/teacher/groups/${g.id}/points`, {
        headers: H, data: { reasonId, studentIds: [g.credentials[0].id] },
      })).ok()).toBeTruthy();
      await page.emulateMedia({ colorScheme });
      await loginUi(page, g.credentials[0].login, g.credentials[0].password);
      await expect(page).toHaveURL('/');
      await page.request.post('/api/student/news/seen', { headers: H, data: { kind: 'level' } });
      await page.goto('/hero');
      await page.getByText('Идеи образов · Искатели').click();
      await page.getByRole('button', { name: 'Примерить образ «Следопыт»' }).click();
      await expect(page.getByRole('button', { name: 'Примерить образ «Навигатор»' })).toBeDisabled();
      await page.getByRole('button', { name: 'Сохранить героя' }).click();
      await expect(page.getByText('Герой сохранён')).toBeVisible();
      await page.reload();
      await page.getByLabel('Коллекция', { exact: true }).selectOption('expedition');
      await page.getByRole('button', { name: /^Костюм/ }).click();
      await expect(page.getByRole('button', { name: /^Куртка следопыта/ })).toHaveAttribute('aria-pressed', 'true');
      for (const width of [1280, 375]) {
        await page.setViewportSize({ width, height: 900 });
        await animationsDone(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      }
    } finally { await g.remove(); }
  });
}
