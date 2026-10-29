import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    // Все тесты работают с одной тестовой БД — запускаем файлы последовательно
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    // Премиум в тестах — по обычным правилам (срок у преподавателя)
    env: { LOGIN_RATE_LIMIT: '1000', PREMIUM_FOR_ALL: 'false' },
  },
});
