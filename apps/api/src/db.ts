import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

/**
 * Prisma 7 работает через драйвер pg. Схема берётся из параметра ?schema= в DATABASE_URL
 * (так тесты используют свою временную схему); сам pg этот параметр не понимает.
 * Опция адаптера schema действует только на запросы Prisma, поэтому для сырого SQL
 * схема дополнительно ставится в search_path соединения.
 */
export function createPrisma(databaseUrl = process.env.DATABASE_URL): PrismaClient {
  if (!databaseUrl) throw new Error('Не задан DATABASE_URL');
  const url = new URL(databaseUrl);
  const schema = url.searchParams.get('schema') ?? undefined;
  url.searchParams.delete('schema');
  const options = schema ? `-c search_path="${schema}"` : undefined;
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options }, { schema }) });
}

export const prisma = createPrisma();
