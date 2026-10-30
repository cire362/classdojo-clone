import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { TEACHER, loginUi, tempGroup, uniq } from './helpers';

const fixture = new URL('../fixtures/noise-tone.wav', import.meta.url).pathname;
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${fixture}`] } });

for (const colorScheme of ['light', 'dark'] as const) {
  test(`шумомер: локальное измерение, порог, проектор и освобождение микрофона (${colorScheme})`, async ({ page, request }) => {
    const group = await tempGroup(request, uniq('E2E шумомер'), ['Лиза Ершова']);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.addInitScript(() => {
        const state = { calls: 0, streams: [] as MediaStream[] };
        (window as any).__noiseTest = state;
        const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          state.calls++;
          const stream = await real(constraints); state.streams.push(stream); return stream;
        };
        (window as any).MediaRecorder = class { constructor() { throw new Error('Запись запрещена в тесте'); } };
      });
      await loginUi(page, TEACHER.login, TEACHER.password);
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      await page.goto(`/g/${group.id}`);
      const panel = page.getByRole('region', { name: 'Шумомер урока', exact: true });
      await panel.getByRole('button', { name: 'Шумомер', exact: true }).click();
      expect(await page.evaluate(() => (window as any).__noiseTest.calls)).toBe(0);
      const writes: string[] = [];
      page.on('request', (r) => { if (r.url().includes('/api/') && r.method() !== 'GET') writes.push(r.url()); });
      await panel.getByRole('button', { name: 'Включить микрофон', exact: true }).click();
      await expect(panel.getByRole('button', { name: 'Выключить микрофон', exact: true })).toBeEnabled();
      await expect.poll(async () => Number(await panel.getByRole('meter').getAttribute('aria-valuenow'))).toBeGreaterThan(20);
      await panel.getByRole('slider').fill('90');
      await expect(panel.getByRole('meter')).toHaveAttribute('aria-valuetext', /В пределах порога/);
      await page.evaluate(() => document.fonts.ready);
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({ path: test.info().outputPath(`noise-desktop-${colorScheme}.png`), animations: 'disabled' });
      await panel.getByRole('slider').fill('10');
      await expect(panel.getByRole('meter')).toHaveAttribute('aria-valuetext', /Давайте потише/);
      await page.getByRole('button', { name: 'Проектор', exact: true }).click();
      await expect(panel.getByRole('button', { name: 'Выключить микрофон', exact: true })).toBeVisible();
      expect(await page.evaluate(() => (window as any).__noiseTest.calls)).toBe(1);
      await page.screenshot({ path: test.info().outputPath(`noise-projector-${colorScheme}.png`), animations: 'disabled' });
      const projectorAxe = await new AxeBuilder({ page }).include('section[aria-label="Шумомер урока"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(projectorAxe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) }))).toEqual([]);
      await page.getByRole('button', { name: 'Выйти из режима проектора', exact: true }).click();
      expect(await page.evaluate(() => (window as any).__noiseTest.calls)).toBe(1);
      await page.setViewportSize({ width: 375, height: 812 });
      await panel.scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await page.screenshot({ path: test.info().outputPath(`noise-mobile-${colorScheme}.png`), animations: 'disabled' });
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
      expect(axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) }))).toEqual([]);
      expect(writes).toEqual([]);
      await panel.getByRole('button', { name: 'Выключить микрофон', exact: true }).click();
      expect(await page.evaluate(() => (window as any).__noiseTest.streams.every((s: MediaStream) => s.getTracks().every((t) => t.readyState === 'ended')))).toBe(true);
      await page.reload();
      await panel.getByRole('button', { name: 'Шумомер', exact: true }).click();
      await expect(panel.getByRole('slider')).toHaveValue('10');
      expect(await page.evaluate(() => (window as any).__noiseTest.calls)).toBe(0);
      await panel.getByRole('button', { name: 'Включить микрофон', exact: true }).click();
      await expect(panel.getByRole('button', { name: 'Выключить микрофон', exact: true })).toBeEnabled();
      await page.getByRole('link', { name: 'Герои класса — главная' }).click();
      await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
      expect(await page.evaluate(() => (window as any).__noiseTest.streams.every((s: MediaStream) => s.getTracks().every((t) => t.readyState === 'ended')))).toBe(true);
    } finally { await group.remove(); }
  });
}
