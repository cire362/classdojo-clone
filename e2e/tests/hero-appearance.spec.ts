import AxeBuilder from '@axe-core/playwright';
import { DEFAULT_HERO } from '@heroes/shared';
import { expect, test } from '@playwright/test';
import { animationsDone, loginUi, tempGroup, uniq } from './helpers';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`ученик меняет заданную учителем внешность на телефоне (${colorScheme})`, async ({ page, request }) => {
    const g = await tempGroup(request, uniq('E2E внешность'), ['Миша']);
    const parts = { ...DEFAULT_HERO, gender: 'gender.girl', hair: 'hair.long', pet: 'pet.fox' };
    try {
      expect((await request.put(`/api/teacher/students/${g.credentials[0].id}/hero`, {
        headers: { 'x-heroes-client': '1' }, data: { name: 'Искатель', parts },
      })).ok()).toBeTruthy();
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 375, height: 812 });
      await loginUi(page, g.credentials[0].login, g.credentials[0].password);
      await expect(page).toHaveURL('/');
      await page.goto('/hero');
      await expect(page.getByRole('button', { name: 'Девочка', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Мальчик', exact: true }).click();
      await page.getByLabel('Коллекция', { exact: true }).selectOption('winter');
      await page.getByRole('button', { name: 'Изменить внешность' }).click();
      await page.getByRole('button', { name: 'Короткая', exact: true }).click();
      await page.getByRole('button', { name: 'Сохранить героя' }).click();
      await expect(page.getByText('Герой сохранён')).toBeVisible();
      await page.reload();
      await page.getByRole('button', { name: 'Изменить внешность' }).click();
      await expect(page.getByRole('button', { name: 'Короткая', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('button', { name: 'Мальчик', exact: true })).toHaveAttribute('aria-pressed', 'true');
      const profile = await (await page.request.get('/api/student/profile')).json();
      expect(profile.hero).toEqual({ name: 'Искатель', parts: { ...parts, gender: 'gender.boy', hair: 'hair.short' } });
      await animationsDone(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: test.info().outputPath('appearance-phone.png'), fullPage: true });
    } finally { await g.remove(); }
  });
}
