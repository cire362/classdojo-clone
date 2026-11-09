import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { animationsDone, loginUi, TEACHER, tempGroup, uniq } from './helpers';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`недельный график: группа, ученик, команда и клавиатура (${colorScheme})`, async ({ page, request }) => {
    const group = await tempGroup(request, uniq('E2E график'), ['Алина Орлова', 'Глеб Орлов']);
    const headers = { 'x-heroes-client': '1' };
    const [a, b] = group.credentials;
    try {
      const [team] = await (await request.post(`/api/teacher/groups/${group.id}/teams`, { headers, data: { name: 'Кометы' } })).json();
      expect((await request.put(`/api/teacher/groups/${group.id}/teams/assign`, { headers, data: { assignments: { [a.id]: team.id } } })).ok()).toBeTruthy();
      const minus = await (await request.post(`/api/teacher/groups/${group.id}/reasons`, { headers, data: { name: 'Не выполнил работу', emoji: '📕', value: -3 } })).json();
      expect((await request.post(`/api/teacher/groups/${group.id}/points`, { headers, data: { studentIds: [a.id], reasonId: minus.id } })).ok()).toBeTruthy();
      const detail = await (await request.get(`/api/teacher/groups/${group.id}`)).json();
      const plus = detail.reasons.find((r: { value: number }) => r.value === 2);
      expect((await request.post(`/api/teacher/groups/${group.id}/points`, { headers, data: { studentIds: [b.id], reasonId: plus.id } })).ok()).toBeTruthy();
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date());
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7);
      const previous = d.toISOString().slice(0, 10);
      for (const date of [today, previous]) expect((await request.post(`/api/teacher/groups/${group.id}/attendance`, { headers, data: { date, lesson: 1, presentStudentIds: [a.id], peopleOnPhoto: null, subtractedTeacher: false } })).ok()).toBeTruthy();
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${group.id}/stats`);
      await page.locator('#from').fill(previous);
      await page.locator('#to').fill(today);
      const chart = page.getByRole('region', { name: 'Динамика по неделям', exact: true });
      await chart.getByRole('button', { name: 'Итого', exact: true }).click();
      await expect(chart.getByText(/за период:/)).toContainText('+1');
      await chart.getByLabel('Кого показать').selectOption(`student:${a.id}`);
      await chart.getByRole('button', { name: 'Итого', exact: true }).click();
      const weeks = chart.getByRole('group', { name: 'Недели на графике' });
      const last = weeks.getByRole('button', { name: /: −2/ });
      await expect(last).toBeVisible();
      await last.focus();
      await page.keyboard.press('ArrowLeft');
      await expect(chart.getByRole('status')).toContainText('итого +1');
      await page.keyboard.press('End');
      await expect(chart.getByRole('status')).toContainText('итого −2');
      await chart.getByLabel('Кого показать').selectOption(`team:${team.id}`);
      await expect(chart.getByText(/Кометы · 1 ученик/)).toBeVisible();
      await expect(chart.getByText(/за период:/)).toContainText('−1');
      await animationsDone(page);
      await page.screenshot({ path: test.info().outputPath(`trends-desktop-${colorScheme}.png`) });
      await chart.screenshot({ path: test.info().outputPath(`trends-panel-${colorScheme}.png`) });
      let result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
      expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) }))).toEqual([]);
      await page.setViewportSize({ width: 375, height: 812 });
      await chart.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 80));
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await page.screenshot({ path: test.info().outputPath(`trends-mobile-${colorScheme}.png`) });
      await chart.getByText('Данные графика таблицей').click();
      await expect(chart.getByRole('table')).toBeVisible();
      await chart.getByRole('button', { name: 'Минусы', exact: true }).click();
      await expect(weeks.getByRole('button', { name: /: −3/ })).toBeVisible();
      // Вкладка только что нажата: посреди перехода цвета дают ложное нарушение контраста
      await animationsDone(page);
      result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
      expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) }))).toEqual([]);
    } finally { await group.remove(); }
  });
}
