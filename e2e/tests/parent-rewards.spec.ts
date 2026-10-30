import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginApi, loginUi, tempGroup, uniq } from './helpers';

const headers = { 'x-heroes-client': '1' };
// Сетевые сбои моделируем напрямую, без перехвата запросов service worker.
test.use({ serviceWorkers: 'block' });
for (const colorScheme of ['light', 'dark'] as const) {
  test(`награды родителю: состояния, дети, просмотр без прочтения и повтор (${colorScheme})`, async ({ page, browser, request }) => {
    const group = await tempGroup(request, uniq('E2E награды родителю'), ['Алина Орлова', 'Глеб Орлов', 'Чужой Ученик']);
    const [alina, gleb, foreign] = group.credentials;
    const student = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      const parent = await (await request.post(`/api/teacher/students/${alina.id}/parents`, { headers })).json();
      expect((await request.post(`/api/teacher/students/${gleb.id}/parents/link`, { headers, data: { login: parent.login } })).ok()).toBeTruthy();
      const detail = await (await request.get(`/api/teacher/groups/${group.id}`)).json();
      const reason = detail.reasons.find((r: { value: number }) => r.value === 2);
      for (let i = 0; i < 2; i++) expect((await request.post(`/api/teacher/groups/${group.id}/points`, { headers, data: { studentIds: [alina.id], reasonId: reason.id } })).ok()).toBeTruthy();
      await loginApi(student.request, alina.login, alina.password);
      const ids: string[] = [];
      for (const title of ['Выбрать игру на перемене', 'Помочь оформить класс к празднику', 'Выбрать музыку']) {
        const rewards = await (await request.post(`/api/teacher/groups/${group.id}/rewards`, { headers, data: { title, emoji: '🎁', cost: 1 } })).json();
        const reward = rewards.find((r: { title: string }) => r.title === title);
        const res = await student.request.post(`/api/student/shop/${reward.id}/request`, { headers });
        expect(res.status()).toBe(201);
        const shop = await res.json();
        ids.push(shop.requests.find((r: { title: string }) => r.title === title).id);
      }
      expect((await request.post(`/api/teacher/reward-requests/${ids[0]}/approve`, { headers })).ok()).toBeTruthy();
      expect((await request.post(`/api/teacher/reward-requests/${ids[1]}/reject`, { headers })).ok()).toBeTruthy();
      const unread = (await (await student.request.get('/api/notifications')).json()).rewards;
      expect(unread).toBe(1);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, parent.login, parent.password);
      await page.route(`**/api/parent/children/${alina.id}/rewards`, (r) => r.fulfill({ status: 503, json: { error: 'Нет связи, попробуйте ещё раз' } }));
      await page.getByRole('button', { name: 'Награды', exact: true }).click();
      const region = page.getByRole('region', { name: 'Награды ребёнка' });
      await expect(region.getByRole('alert')).toContainText('Нет связи');
      await page.unroute(`**/api/parent/children/${alina.id}/rewards`);
      await region.getByRole('button', { name: 'Повторить' }).click();
      await expect(region.getByText('Баланс для наград: 2 балла')).toBeVisible();
      for (const text of ['Ждёт ответа', 'Выдано', 'Отказано', 'Баллы возвращены.']) await expect(region.getByText(text, { exact: true })).toBeVisible();
      await expect(region.getByRole('button', { name: /Попросить|Выдать|Отказать|Отменить/ })).toHaveCount(0);
      expect((await page.request.get(`/api/parent/children/${foreign.id}/rewards`)).status()).toBe(404);
      expect((await (await student.request.get('/api/notifications')).json()).rewards).toBe(unread);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: test.info().outputPath(`parent-rewards-desktop-${colorScheme}.png`), animations: 'disabled' });
      await page.screenshot({ path: test.info().outputPath(`parent-rewards-full-desktop-${colorScheme}.png`), fullPage: true, animations: 'disabled' });
      for (const width of [1280, 375]) {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
        expect(axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) }))).toEqual([]);
      }
      await page.screenshot({ path: test.info().outputPath(`parent-rewards-mobile-${colorScheme}.png`), animations: 'disabled' });
      await region.getByText('Награды группы (7)', { exact: true }).click();
      await expect(region.locator('details').getByText('Выбрать игру на перемене', { exact: true })).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: test.info().outputPath(`parent-rewards-full-mobile-${colorScheme}.png`), fullPage: true, animations: 'disabled' });
      await page.getByRole('tab', { name: /Глеб Орлов/ }).click();
      await expect(region.getByText(`Глеб Орлов, ${detail.group.name}`, { exact: true })).toBeVisible();
      await expect(region.getByText('Решений пока нет', { exact: true })).toBeVisible();
      await expect(region.getByText('Ждёт ответа', { exact: true })).toHaveCount(0);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: test.info().outputPath(`parent-rewards-empty-mobile-${colorScheme}.png`), animations: 'disabled' });
      await page.getByRole('tab', { name: /Алина Орлова/ }).click();
      await expect(region.getByText('Ждёт ответа', { exact: true })).toBeVisible();
      expect((await request.post(`/api/teacher/reward-requests/${ids[2]}/approve`, { headers })).ok()).toBeTruthy();
      await region.getByRole('button', { name: 'Обновить' }).click();
      await expect(region.getByText('Ожидающих запросов нет.', { exact: true })).toBeVisible();
      await expect(region.getByText('Выдано', { exact: true })).toHaveCount(2);
    } finally { await student.close(); await group.remove(); }
  });
}
