/**
 * Иконки приложения (PWA) из логотипа: кирпичный круг с белой звездой.
 * Запуск из корня репозитория (нужен Chrome или Chromium Playwright):
 *   node apps/web/scripts/make-icons.mjs
 * Обычная иконка — круг на прозрачном фоне; maskable — на тёмно-оливковом квадрате с запасом под обрезку.
 */
import { chromium } from '@playwright/test';

const OUT = new URL('../public/', import.meta.url).pathname;
const STAR = 'M18 8.5l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L18 22.3l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z';
const logo = (bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">${bg ? `<rect width="36" height="36" fill="${bg}"/>` : ''}` +
  `<circle cx="18" cy="18" r="${bg ? 12.5 : 18}" fill="#c4471f"/>` +
  `<g transform="${bg ? 'translate(18 18) scale(0.7) translate(-18 -17)' : 'translate(0 1)'}"><path d="${STAR}" fill="#ffffff"/></g></svg>`;

const icons = [
  ['icon-192.png', 192, null],
  ['icon-512.png', 512, null],
  ['icon-maskable-512.png', 512, '#1e211a'],
  ['apple-touch-icon.png', 180, '#1e211a'],
];

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' });
const page = await browser.newPage();
for (const [file, size, bg] of icons) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${logo(bg)}`);
  await page.locator('svg').screenshot({ path: OUT + file, omitBackground: !bg });
  console.log(file);
}
await browser.close();
