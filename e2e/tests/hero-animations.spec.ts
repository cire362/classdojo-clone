import { expect, test, type Page } from '@playwright/test';
import { loginUi, tempGroup, uniq } from './helpers';

const animation = (page: Page, selector: string) =>
  page.locator(`.hero-alive ${selector}`).first().evaluate((el) => getComputedStyle(el).animationName);

test('герой в кабинете ученика живой, а при «уменьшить движение» замирает', async ({ page, request }) => {
  const group = await tempGroup(request, uniq('E2E анимации'), ['Лиза Ершова']);
  try {
    const student = group.credentials[0];
    await loginUi(page, student.login, student.password);
    await expect(page.getByRole('link', { name: 'Собрать героя' })).toBeVisible();
    expect(await animation(page, '.hero-body')).toBe('hero-breathe');
    expect(await animation(page, '.hero-eyes')).toBe('hero-blink');
    // Карточки в списках не анимируются: живой герой на странице один
    await expect(page.locator('.hero-alive')).toHaveCount(1);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await animation(page, '.hero-body')).toBe('none');
    expect(await animation(page, '.hero-eyes')).toBe('none');
  } finally {
    await group.remove();
  }
});
