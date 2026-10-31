import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { env } from './platform/env.js';
import { cleanupLoginAttempts } from './platform/auth.js';
import { syncHeroParts } from './modules/hero/index.js';

await syncHeroParts();
await cleanupLoginAttempts();

serve({ fetch: createApp().fetch, port: env.port }, (info) => {
  console.log(`API «Герои класса» слушает порт ${info.port} (TZ=${process.env.TZ ?? 'system'})`);
});
