import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { animationsDone, loginUi, tempGroup, uniq } from './helpers';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`итог недели родителю: баллы, уроки, прошлые недели и дети (${colorScheme})`, async ({ page, request }) => {
    const group = await tempGroup(request, uniq('E2E итог недели'), ['Алина Орлова', 'Глеб Орлов', 'Другой Ученик']);
    const headers = { 'x-heroes-client': '1' };
    const [alina, gleb, foreign] = group.credentials;
    try {
      const parent = await (await request.post(`/api/teacher/students/${alina.id}/parents`, { headers })).json();
      expect((await request.post(`/api/teacher/students/${gleb.id}/parents/link`, { headers, data: { login: parent.login } })).ok()).toBeTruthy();
      const detail = await (await request.get(`/api/teacher/groups/${group.id}`)).json();
      const plus = detail.reasons.find((r: { value: number }) => r.value === 2);
      const minus = detail.reasons.find((r: { value: number }) => r.value === -1);
      for (const reason of [plus, minus]) {
        expect((await request.post(`/api/teacher/groups/${group.id}/points`, { headers, data: { studentIds: [alina.id], reasonId: reason.id } })).ok()).toBeTruthy();
      }
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date());
      const previous = new Date(`${today}T12:00:00Z`);
      previous.setUTCDate(previous.getUTCDate() - ((previous.getUTCDay() + 6) % 7) - 7);
      const past = previous.toISOString().slice(0, 10);
      for (const [date, lesson, presentStudentIds] of [[today, 1, [alina.id]], [today, 2, [gleb.id]], [past, 1, [alina.id]]] as const) {
        expect((await request.post(`/api/teacher/groups/${group.id}/attendance`, { headers, data: { date, lesson, presentStudentIds, peopleOnPhoto: null, subtractedTeacher: false } })).ok()).toBeTruthy();
      }
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, parent.login, parent.password);
      await page.getByRole('button', { name: 'Итог недели', exact: true }).click();
      const summary = page.getByRole('region', { name: 'Итог недели', exact: true });
      await expect(summary.getByText(plus.name, { exact: true })).toBeVisible();
      await expect(summary.getByText('+3', { exact: true })).toBeVisible();
      await expect(summary.getByText('1 из 2', { exact: true })).toBeVisible();
      await expect(summary.getByText('Пропуск', { exact: true })).toBeVisible();
      await expect(summary.getByRole('button', { name: 'Следующая неделя' })).toBeDisabled();
      expect((await page.request.get(`/api/parent/children/${foreign.id}/weekly-summary`)).status()).toBe(404);
      await animationsDone(page);
      await page.screenshot({ path: test.info().outputPath(`weekly-desktop-${colorScheme}.png`) });
      await page.screenshot({ path: test.info().outputPath(`weekly-full-${colorScheme}.png`), fullPage: true });
      let result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

      await page.setViewportSize({ width: 375, height: 812 });
      await page.evaluate(() => window.scrollTo(0, 0));
      // После смены размера ждём отрисовку закреплённой шапки в новом окне.
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await page.screenshot({ path: test.info().outputPath(`weekly-mobile-${colorScheme}.png`) });
      await summary.getByRole('button', { name: 'Предыдущая неделя' }).click();
      await expect(summary.getByLabel('Неделя с')).toHaveValue(past);
      await expect(summary.getByText('1 из 1', { exact: true })).toBeVisible();
      await expect(summary.getByText('+1', { exact: true })).toHaveCount(3);
      await summary.getByRole('button', { name: 'Предыдущая неделя' }).click();
      await expect(summary.getByText('Отметок за эту неделю пока нет.')).toBeVisible();
      await expect(summary.getByText('За эту неделю начислений и списаний пока нет.')).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: test.info().outputPath(`weekly-empty-${colorScheme}.png`) });
      await summary.getByRole('button', { name: 'Текущая неделя', exact: true }).click();
      await expect(summary.getByText(plus.name, { exact: true })).toBeVisible();
      await page.getByRole('tab', { name: /Глеб Орлов/ }).click();
      await expect(summary.getByText(`Глеб Орлов, ${detail.group.name}`, { exact: true })).toBeVisible();
      await expect(summary.getByText(plus.name, { exact: true })).toHaveCount(0);
      await expect(summary.getByText('1 из 2', { exact: true })).toBeVisible();
      await expect(summary.getByRole('button', { name: 'Следующая неделя' })).toBeDisabled();
      await animationsDone(page);
      result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ target: n.target, details: n.failureSummary })) }))).toEqual([]);
    } finally {
      await group.remove();
    }
  });
}
