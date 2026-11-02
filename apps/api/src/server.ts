import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { env } from './platform/env.js';
import { cleanupLoginAttempts } from './platform/auth.js';
import { purgeDeletedFiles } from './modules/files/index.js';
import { syncHeroParts } from './modules/hero/index.js';

/** Подстраховка: удаления без своей очистки и файлы, которые не удалось стереть сразу */
const PURGE_INTERVAL = 60 * 60 * 1000;

await syncHeroParts();
await cleanupLoginAttempts();
await purgeDeletedFiles();
setInterval(() => void purgeDeletedFiles().catch(console.error), PURGE_INTERVAL).unref();

serve({ fetch: createApp().fetch, port: env.port }, (info) => {
  console.log(`API «Герои класса» слушает порт ${info.port} (TZ=${process.env.TZ ?? 'system'})`);
});
