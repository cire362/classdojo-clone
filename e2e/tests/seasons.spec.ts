import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEFAULT_HERO, HERO_COLLECTIONS, HERO_PARTS, HERO_SLOTS, renderHeroSvg, type HeroParts } from '@heroes/shared';
import { loginUi, tempGroup, uniq } from './helpers';

const headers = { 'x-heroes-client': '1' };

test('все сезонные детали помещаются в холст, четыре оригинальных образа', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 440 });
  const seasonal = HERO_PARTS.filter((p) => p.collection && p.collection !== 'cosmos');
  const outfit = (collection: string) => {
    const parts = { ...DEFAULT_HERO };
    for (const [slot, layer] of Object.entries(HERO_SLOTS)) {
      const part = seasonal.find((p) => p.collection === collection && p.layer === layer);
      if (part) parts[slot as keyof HeroParts] = part.id;
    }
    parts.accentColor = ({ spring: 'color.pink', summer: 'color.yellow', autumn: 'color.orange', winter: 'color.navy' } as Record<string, string>)[collection];
    return parts;
  };
  const examples = HERO_COLLECTIONS.filter((c) => c.id !== 'cosmos');
  await page.setContent(`<main style="font-family:sans-serif;color:#1b1f4b;background:#f3f4fa;padding:24px"><h1 style="font-size:22px;margin:0 0 16px">Сезонные коллекции · примеры образов</h1><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">${examples.map((c) => `<figure style="margin:0;text-align:center"><div>${renderHeroSvg(outfit(c.id), { level: 5 })}</div><figcaption>${c.name}</figcaption></figure>`).join('')}</div></main>`);
  await page.screenshot({ path: test.info().outputPath('seasons-outfits.png'), animations: 'disabled' });
  await page.setContent(`<main>${seasonal.map((p) => {
    const slot = Object.entries(HERO_SLOTS).find(([, layer]) => layer === p.layer)![0];
    return `<div data-part="${p.id}">${renderHeroSvg({ ...DEFAULT_HERO, [slot]: p.id })}</div>`;
  }).join('')}</main>`);
  const bounds = await page.locator('[data-part] svg').evaluateAll((svgs) => svgs.map((svg) => {
    const b = (svg as SVGSVGElement).getBBox();
    return { id: svg.parentElement?.getAttribute('data-part'), x: b.x, y: b.y, right: b.x + b.width, bottom: b.y + b.height };
  }));
  expect(bounds).toHaveLength(24);
  for (const b of bounds) {
    expect(b.x, b.id!).toBeGreaterThanOrEqual(1.5);
    expect(b.y, b.id!).toBeGreaterThanOrEqual(1.5);
    expect(b.right, b.id!).toBeLessThanOrEqual(198.5);
    expect(b.bottom, b.id!).toBeLessThanOrEqual(238.5);
  }
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`сезонные коллекции: бесплатный доступ, уровни, смешивание и сохранение (${colorScheme})`, async ({ page, request }) => {
    const group = await tempGroup(request, uniq('E2E сезоны'), ['Лиза Ершова']);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      const student = group.credentials[0];
      await loginUi(page, student.login, student.password);
      await expect(page.getByRole('link', { name: 'Собрать героя' })).toBeVisible();
      expect((await (await page.request.get('/api/student/profile')).json()).premium).toBe(true);
      await page.goto('/hero');
      const collection = page.getByLabel('Коллекция', { exact: true });
      const tabs = page.getByRole('navigation', { name: 'Детали героя' });
      await collection.selectOption('winter');
      const frost = page.getByRole('button', { name: /^Полярный.*откроется на 2 уровне/ });
      await frost.click();
      await expect(page.getByText('Откроется на 2 уровне', { exact: true })).toBeVisible();
      await expect(frost).toHaveAttribute('aria-pressed', 'false');
      const reason = await (await request.post(`/api/teacher/groups/${group.id}/reasons`, { headers, data: { name: 'Проект', value: 10, emoji: '⭐' } })).json();
      for (let i = 0; i < 7; i++) expect((await request.post(`/api/teacher/groups/${group.id}/points`, { headers, data: { studentIds: [student.id], reasonId: reason.id } })).ok()).toBeTruthy();
      await page.request.post('/api/student/news/seen', { headers, data: { kind: 'level' } });
      await page.reload();
      const pick = async (id: string, slot: string, name: string) => {
        await collection.selectOption(id);
        await tabs.getByRole('button', { name: new RegExp(`^${slot}`) }).click();
        await page.getByRole('button', { name: new RegExp(`^${name}.*коллекция`) }).click();
      };
      await pick('spring', 'Костюм', 'Цветущий');
      await pick('summer', 'Плащ', 'Парус');
      await pick('autumn', 'Эмблема', 'Кленовый лист');
      await pick('winter', 'Маска', 'Зимняя шапка');
      await pick('winter', 'Сияние', 'Снегопад');
      await pick('winter', 'Цвет костюма', 'Лёд');
      await pick('summer', 'Цвет плаща', 'Лагуна');
      await page.getByRole('button', { name: 'Сохранить героя', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Сохранено', exact: true })).toBeDisabled();
      const saved = (await (await page.request.get('/api/student/profile')).json()).hero.parts;
      expect(saved).toMatchObject({ suit: 'suit.bloom', cape: 'cape.sail', emblem: 'emblem.maple', mask: 'mask.winterHat', aura: 'aura.snowfall', suitColor: 'color.ice', accentColor: 'color.lagoon' });
      await page.reload();
      await collection.selectOption('winter');
      await tabs.getByRole('button', { name: /^Маска/ }).click();
      await expect(page.getByRole('button', { name: /^Зимняя шапка.*коллекция/ })).toHaveAttribute('aria-pressed', 'true');
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: test.info().outputPath(`seasons-desktop-${colorScheme}.png`), animations: 'disabled' });
      await page.screenshot({ path: test.info().outputPath(`seasons-full-desktop-${colorScheme}.png`), fullPage: true, animations: 'disabled' });
      for (const width of [1280, 375]) {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        await page.evaluate(() => scrollTo(0, 0));
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
        expect(axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.failureSummary) }))).toEqual([]);
      }
      await page.screenshot({ path: test.info().outputPath(`seasons-mobile-${colorScheme}.png`), animations: 'disabled' });
      await page.screenshot({ path: test.info().outputPath(`seasons-full-mobile-${colorScheme}.png`), fullPage: true, animations: 'disabled' });
      await collection.evaluate((el) => scrollTo(0, el.getBoundingClientRect().top + scrollY - 160));
      await page.screenshot({ path: test.info().outputPath(`seasons-controls-mobile-${colorScheme}.png`), animations: 'disabled' });
      await tabs.getByRole('button', { name: /^Поза/ }).click();
      await expect(page.getByText(/В этой коллекции нет деталей/)).toBeVisible();
      await page.getByRole('button', { name: 'Показать все детали' }).click();
      await expect(collection).toHaveValue('all');
      await expect(page.getByRole('button', { name: 'Сохранено', exact: true })).toBeDisabled();
    } finally { await group.remove(); }
  });
}
