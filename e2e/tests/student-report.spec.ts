import { readFile } from 'node:fs/promises';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { TEACHER, loginUi, tempGroup, uniq } from './helpers';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`PDF ученика: период, скачивание, ошибка и повтор (${colorScheme})`, async ({ page, request }) => {
    const group = await tempGroup(request, uniq('E2E PDF'), ['Алёна Иванова', 'Другой Ученик']);
    const student = group.credentials[0];
    const headers = { 'x-heroes-client': '1' };
    try {
      const detail = await (await request.get(`/api/teacher/groups/${group.id}`)).json();
      const plus = detail.reasons.find((r: { value: number }) => r.value === 2);
      expect((await request.post(`/api/teacher/groups/${group.id}/points`, { headers, data: { studentIds: [student.id], reasonId: plus.id } })).ok()).toBeTruthy();
      expect((await request.post(`/api/teacher/groups/${group.id}/attendance`, { headers, data: { lesson: 1, presentStudentIds: [student.id], peopleOnPhoto: null, subtractedTeacher: false } })).ok()).toBeTruthy();
      expect((await request.post(`/api/teacher/groups/${group.id}/attendance`, { headers, data: { lesson: 2, presentStudentIds: [], peopleOnPhoto: null, subtractedTeacher: false } })).ok()).toBeTruthy();
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/s/${student.id}`);
      await page.getByText('Отчёт в PDF', { exact: true }).click();
      const panel = page.locator('details').filter({ has: page.getByText('Отчёт в PDF', { exact: true }) });
      await expect(panel.getByRole('button', { name: 'Скачать PDF', exact: true })).toBeEnabled();
      const downloadPromise = page.waitForEvent('download');
      await panel.getByRole('button', { name: 'Скачать PDF', exact: true }).click();
      const downloaded = await downloadPromise;
      expect(downloaded.suggestedFilename()).toContain('Алёна Иванова');
      await downloaded.saveAs(test.info().outputPath(`report-${colorScheme}.pdf`));
      const bytes = await readFile(test.info().outputPath(`report-${colorScheme}.pdf`));
      expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
      expect(bytes.toString('latin1')).toContain('/ToUnicode');
      await expect(page).toHaveURL(new RegExp(`/s/${student.id}$`));
      const path = `**/api/teacher/students/${student.id}/report.pdf?*`;
      await page.route(path, (r) => r.abort('internetdisconnected'));
      await panel.getByRole('button', { name: 'Скачать PDF', exact: true }).click();
      await expect(panel.getByRole('alert')).toContainText('Нет связи');
      await page.unroute(path);
      const retry = page.waitForEvent('download');
      await panel.getByRole('button', { name: 'Скачать PDF', exact: true }).click();
      await retry;
      await expect(panel.getByRole('alert')).toHaveCount(0);
      await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
      await page.screenshot({ path: test.info().outputPath(`report-desktop-${colorScheme}.png`) });
      let result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
      expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) }))).toEqual([]);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await page.screenshot({ path: test.info().outputPath(`report-mobile-${colorScheme}.png`) });
      result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
      expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) }))).toEqual([]);
    } finally { await group.remove(); }
  });
}
