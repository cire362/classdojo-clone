import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { TEACHER, loginUi, loginApi, tempGroup, uniq } from './helpers';

const headers = { 'x-heroes-client': '1' };

for (const colorScheme of ['light', 'dark'] as const) {
  test(`значки: условия, помощь, посещаемость, первенство и исправление (${colorScheme})`, async ({ page, request }) => {
    const g = await tempGroup(request, uniq('E2E значки'), ['Лиза Ершова', 'Марк Орлов']);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/s/${g.credentials[0].id}`);
      const summary = page.getByRole('region', { name: 'Значки достижений', exact: true });
      await expect(summary).toContainText('0 из 3');
      await summary.getByRole('button', { name: 'Все значки' }).click();
      await expect(page.getByRole('progressbar', { name: 'Надёжный друг' })).toHaveAttribute('aria-valuetext', '0 из 20');

      await page.goto(`/g/${g.id}/reasons`);
      await page.getByRole('button', { name: 'Новая причина' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Название', { exact: true }).fill('Объяснил задачу');
      await dialog.getByRole('checkbox', { name: 'Учитывать для значка «Надёжный друг»' }).check();
      await dialog.getByRole('button', { name: 'Сохранить' }).click();
      await expect(dialog).toHaveCount(0);
      const reasons = await (await request.get(`/api/teacher/groups/${g.id}/reasons`)).json();
      const help = reasons.find((r: { name: string }) => r.name === 'Объяснил задачу');
      expect(help.countsForHelpBadge).toBe(true);
      const ten = await (await request.post(`/api/teacher/groups/${g.id}/reasons`, { data: { name: 'Отличный проект', emoji: '⭐', value: 10 }, headers })).json();
      const award = async (reasonId: string, ids = [g.credentials[0].id]) => {
        const response = await request.post(`/api/teacher/groups/${g.id}/points`, { data: { reasonId, studentIds: ids }, headers });
        expect(response.ok()).toBeTruthy();
        return response.json();
      };
      for (let i = 0; i < 7; i++) await award(ten.id, g.credentials.map((s) => s.id));
      for (let i = 0; i < 19; i++) await award(help.id);
      for (let i = 0; i < 10; i++) {
        const date = new Date();
        date.setDate(date.getDate() - 6 + Math.floor(i / 2));
        const key = date.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });
        const response = await request.post(`/api/teacher/groups/${g.id}/attendance`, { data: { date: key, lesson: i % 2 + 1, presentStudentIds: g.credentials.map((s) => s.id), peopleOnPhoto: null, subtractedTeacher: false }, headers });
        expect(response.ok()).toBeTruthy();
      }
      await page.goto(`/s/${g.credentials[0].id}`);
      await expect(summary).toContainText('2 из 3');
      await summary.getByRole('button', { name: 'Все значки' }).click();
      const collection = page.getByRole('region', { name: 'Условия получения значков' });
      await expect(collection.getByRole('progressbar', { name: 'Надёжный друг' })).toHaveAttribute('aria-valuetext', '19 из 20');
      await expect(collection.getByText(`Группа: ${g.id}`, { exact: true })).toHaveCount(0);
      await expect(collection.getByText(/Группа: E2E значки/)).toBeVisible();
      for (const width of [1280, 375]) {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
        expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
        await page.screenshot({ path: test.info().outputPath(`badges-${width}-${colorScheme}.png`), fullPage: true });
      }

      const final = await award(help.id);
      await page.reload();
      await expect(summary).toContainText('3 из 3');
      await request.post('/api/teacher/points/undo', { data: { eventIds: final.eventIds }, headers });
      await page.reload();
      await expect(summary).toContainText('2 из 3');

      // Та же коллекция в собственном кабинете; исправленный прогресс не сохраняется в кэше.
      await loginApi(page.request, g.credentials[0].login, g.credentials[0].password);
      await page.request.post('/api/student/news/seen', { data: { kind: 'level' }, headers });
      await page.goto('/');
      await expect(summary).toContainText('2 из 3');
      await summary.getByRole('button', { name: 'Все значки' }).click();
      await expect(page.getByRole('progressbar', { name: 'Надёжный друг' })).toHaveAttribute('aria-valuetext', '19 из 20');
      expect(await page.getByRole('button', { name: 'Записать достижение' }).count()).toBe(0);
    } finally {
      await g.remove();
    }
  });
}
