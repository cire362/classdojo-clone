import { execSync } from 'node:child_process';
import { createPrisma } from '../src/db';

/**
 * Каждый прогон тестов работает в собственной новой схеме PostgreSQL:
 * миграции накатываются обычным `prisma migrate deploy`, а по окончании
 * удаляется только эта временная схема. Существующие данные не затрагиваются.
 */
export default async function setup() {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('Укажите DATABASE_URL тестовой базы');
  const schema = `test_run_${Date.now()}_${process.pid}`;
  const url = new URL(base);
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();

  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url.toString() } });

  return async () => {
    const prisma = createPrisma(url.toString());
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await prisma.$disconnect();
  };
}
