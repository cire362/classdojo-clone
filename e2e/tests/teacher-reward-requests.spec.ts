import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginApi, loginUi, TEACHER, tempGroup, uniq } from './helpers';

const headers = { 'x-heroes-client': '1' };
for (const colorScheme of ['light', 'dark'] as const) {
  test(`общие запросы наград: две группы, архив, решения и повтор (${colorScheme})`, async ({ page, browser, request }) => {
    const first = await tempGroup(request, uniq('E2E 5 «А»'), ['Маша Иванова']);
    const second = await tempGroup(request, uniq('E2E Клуб исследователей дальнего космоса'), ['Петя Смирнов']);
    try {
      for (const group of [first, second]) {
        const details = await (await request.get(`/api/teacher/groups/${group.id}`)).json();
        const reason = details.reasons.find((r: { value: number }) => r.value === 2);
        expect((await request.post(`/api/teacher/groups/${group.id}/points`, { headers, data: { studentIds: [group.credentials[0].id], reasonId: reason.id } })).ok()).toBeTruthy();
        const rewards = await (await request.post(`/api/teacher/groups/${group.id}/rewards`, { headers, data: { title: 'Выбрать игру', emoji: '🎁', cost: 1 } })).json();
        const reward = rewards.find((r: { title: string }) => r.title === 'Выбрать игру');
        const student = await browser.newContext({ baseURL: test.info().project.use.baseURL });
        try {
          await loginApi(student.request, group.credentials[0].login, group.credentials[0].password);
          expect((await student.request.post(`/api/student/shop/${reward.id}/request`, { headers })).status()).toBe(201);
        } finally { await student.close(); }
      }
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      const header = page.locator('header');
      const badge = header.getByRole('link', { name: /Запросы наград/ });
      await expect(badge).toHaveAccessibleName('Запросы наград 2 ожидающих запроса');
      await page.route('**/api/teacher/reward-requests', (r) => r.fulfill({ status: 503, json: { error: 'Не удалось загрузить запросы' } }));
      await badge.click();
      await expect(page.getByRole('alert')).toContainText('Не удалось загрузить запросы');
      await page.unroute('**/api/teacher/reward-requests');
      await page.getByRole('button', { name: 'Повторить' }).click();
      await expect(page.locator('main ul li')).toHaveCount(2);
      await expect(page.getByRole('link', { name: /5 «А».*1 запрос ждёт ответа/ })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: test.info().outputPath(`requests-desktop-${colorScheme}.png`) });
      for (const width of [1280, 375]) {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
        expect(axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) }))).toEqual([]);
      }
      await page.screenshot({ path: test.info().outputPath(`requests-mobile-${colorScheme}.png`) });

      expect((await request.post(`/api/teacher/groups/${second.id}/archive`, { headers })).ok()).toBeTruthy();
      await page.getByRole('button', { name: 'Обновить' }).click();
      await expect(badge).toHaveAccessibleName('Запросы наград 1 ожидающий запрос');
      await expect(page.locator('main ul li')).toHaveCount(1);
      expect((await request.post(`/api/teacher/groups/${second.id}/restore`, { headers })).ok()).toBeTruthy();
      await page.getByRole('button', { name: 'Обновить' }).click();
      await expect(badge).toHaveAccessibleName('Запросы наград 2 ожидающих запроса');
      await page.getByRole('link', { name: /5 «А».*1 запрос ждёт ответа/ }).click();
      await page.getByRole('button', { name: 'Выдать', exact: true }).click();
      await expect(badge).toHaveAccessibleName('Запросы наград 1 ожидающий запрос');
      await badge.click();
      await page.getByRole('link', { name: /Клуб исследователей.*1 запрос ждёт ответа/ }).click();
      await page.getByRole('button', { name: 'Отказать', exact: true }).click();
      await expect(badge).toHaveAccessibleName('Запросы наград');
      await badge.click();
      await expect(page.getByRole('heading', { name: 'Ожидающих запросов нет' })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`requests-empty-mobile-${colorScheme}.png`) });
    } finally { await first.remove(); await second.remove(); }
  });
}
