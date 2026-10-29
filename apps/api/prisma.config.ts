import { defineConfig } from 'prisma/config';

// Prisma 7 больше не читает .env сам: адрес базы приходит из окружения (docker compose, тесты).
// process.env, а не env(): `prisma generate` при сборке образа работает без базы.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
