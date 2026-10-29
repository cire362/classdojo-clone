import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PET_COMPANIONS, renderPetSvg } from '@heroes/shared';
import { TEACHER, loginApi, loginUi, tempGroup, uniq } from './helpers';

const headers = { 'x-heroes-client': '1' };

test('рисунки всех питомцев и стадий помещаются в холст', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 800 });
  await page.setContent(`<main style="font-family:sans-serif;color:#1b1f4b;background:#f3f4fa;padding:24px"><h1>Рост питомцев</h1><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">${PET_COMPANIONS.flatMap((pet) => [1, 4, 7].map((level) => `<figure style="margin:0"><div>${renderPetSvg(pet.id, level)}</div><figcaption>${pet.name} · уровень ${level}</figcaption></figure>`)).join('')}</div></main>`);
  const bounds = await page.locator('svg').evaluateAll((svgs) => svgs.map((svg) => {
    const b = (svg as SVGSVGElement).getBBox();
    return { x: b.x, y: b.y, right: b.x + b.width, bottom: b.y + b.height };
  }));
  expect(bounds).toHaveLength(9);
  for (const box of bounds) {
    expect(box.x).toBeGreaterThanOrEqual(1.2);
    expect(box.y).toBeGreaterThanOrEqual(1.2);
    expect(box.right).toBeLessThanOrEqual(62.8);
    expect(box.bottom).toBeLessThanOrEqual(62.8);
  }
  await page.screenshot({ path: test.info().outputPath('pets-stages.png'), fullPage: true });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`питомец: выбор, сохранение, рост и проектор (${colorScheme})`, async ({ page, request }) => {
    const g = await tempGroup(request, uniq('E2E питомцы'), ['Лиза Ершова']);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await loginUi(page, g.credentials[0].login, g.credentials[0].password);
      await expect(page.getByRole('link', { name: 'Собрать героя' })).toBeVisible();
      await page.goto('/hero');
      await page.getByRole('button', { name: 'Выбрать питомца' }).click();
      await page.getByRole('button', { name: 'Искрик', exact: true }).click();
      await page.getByRole('button', { name: 'Сохранить героя' }).click();
      await expect(page.getByRole('button', { name: 'Сохранено' })).toBeDisabled();
      await page.goto('/');
      const portrait = page.getByRole('img', { name: g.credentials[0].name, exact: true });
      await expect(page.getByLabel('Питомец героя', { exact: true })).toContainText('Малыш');
      await expect(portrait.locator('[data-pet="pet.fox"]')).toHaveAttribute('data-pet-stage', '1');

      const reasons: Record<number, string> = {};
      for (const value of [5, 10]) reasons[value] = (await (await request.post(`/api/teacher/groups/${g.id}/reasons`, { data: { name: `Проект +${value}`, value, emoji: '⭐' }, headers })).json()).id;
      const award = async (value: number, times: number) => {
        for (let i = 0; i < times; i++) expect((await request.post(`/api/teacher/groups/${g.id}/points`, { data: { reasonId: reasons[value], studentIds: [g.credentials[0].id] }, headers })).ok()).toBeTruthy();
      };
      const reloadCabinet = async () => {
        await page.request.post('/api/student/news/seen', { data: { kind: 'level' }, headers });
        await page.reload();
      };
      await award(10, 4); await award(5, 1); // 45 баллов → 4 уровень
      await reloadCabinet();
      await expect(page.getByLabel('Питомец героя', { exact: true })).toContainText('Напарник');
      await expect(portrait.locator('[data-pet="pet.fox"]')).toHaveAttribute('data-pet-stage', '2');
      await award(10, 9); await award(5, 1); // 140 баллов → 7 уровень
      await reloadCabinet();
      await expect(page.getByLabel('Питомец героя', { exact: true })).toContainText('Хранитель');
      await expect(portrait.locator('[data-pet="pet.fox"]')).toHaveAttribute('data-pet-stage', '3');

      await page.goto('/hero');
      await page.getByRole('button', { name: 'Изменить питомца' }).click();
      await expect(page.getByRole('button', { name: 'Искрик', exact: true })).toHaveAttribute('aria-pressed', 'true');
      for (const width of [1280, 375]) {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        await page.getByRole('button', { name: 'Изменить питомца' }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
        expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
        await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
        if (width === 1280) {
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({ path: test.info().outputPath(`pets-editor-${width}-${colorScheme}.png`), fullPage: true });
        } else {
          const captureOptions = async (state: string) => {
            await page.getByRole('region', { name: 'Рост питомца' }).evaluate((el) => scrollTo(0, el.getBoundingClientRect().top + scrollY - 128));
            await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
            await page.screenshot({ path: test.info().outputPath(`pets-mobile-${state}-${colorScheme}.png`) });
          };
          await captureOptions('resized');
          await page.reload();
          await page.getByRole('button', { name: 'Изменить питомца' }).click();
          await captureOptions('fresh');
        }
      }

      // Выбор принадлежит ученику и остаётся тем же на уроке и проекторе.
      await page.setViewportSize({ width: 1280, height: 900 });
      await loginApi(page.request, TEACHER.login, TEACHER.password);
      await page.goto(`/g/${g.id}`);
      const student = page.getByRole('button', { name: /^Лиза Ершова/ });
      await expect(student.locator('[data-pet="pet.fox"]')).toHaveAttribute('data-pet-stage', '3');
      await page.getByRole('button', { name: 'Проектор', exact: true }).click();
      const projector = page.locator('.fixed.inset-0.z-40');
      await expect(projector.locator('[data-pet="pet.fox"]')).toHaveAttribute('data-pet-stage', '3');
      await page.screenshot({ path: test.info().outputPath(`pets-projector-${colorScheme}.png`), fullPage: true });
    } finally {
      await g.remove();
    }
  });
}
