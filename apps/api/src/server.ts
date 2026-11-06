import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { env } from './platform/env.js';
import { cleanupLoginAttempts } from './platform/auth.js';
import { expireArchivedFiles, purgeDeletedFiles } from './modules/files/index.js';
import { syncHeroParts } from './modules/hero/index.js';

/** Раз в час: срок хранения файлов архивных групп и подстраховка для файлов, которые не удалось стереть сразу */
const PURGE_INTERVAL = 60 * 60 * 1000;
const housekeeping = async () => {
  await expireArchivedFiles();
  await purgeDeletedFiles();
};

await syncHeroParts();
await cleanupLoginAttempts();
await housekeeping();
setInterval(() => void housekeeping().catch(console.error), PURGE_INTERVAL).unref();

serve({ fetch: createApp().fetch, port: env.port }, (info) => {
  console.log(`API «Герои класса» слушает порт ${info.port} (TZ=${process.env.TZ ?? 'system'})`);
});
