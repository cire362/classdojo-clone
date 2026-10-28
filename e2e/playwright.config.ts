import { defineConfig, devices } from '@playwright/test';

/**
 * Сквозные тесты против запущенного стека (docker compose).
 * E2E_BASE_URL — адрес сайта (по умолчанию http://localhost:8080).
 * PW_CHANNEL=chrome — использовать установленный Chrome вместо скачанного Chromium.
 */
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], channel, viewport: { width: 1280, height: 900 } },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: 'phone',
      use: { ...devices['Desktop Chrome'], channel, viewport: { width: 375, height: 812 }, isMobile: false, hasTouch: true },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
});
