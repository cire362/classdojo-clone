import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { env } from './env.js';
import { syncHeroParts } from './services/heroParts.js';

await syncHeroParts();

serve({ fetch: createApp().fetch, port: env.port }, (info) => {
  console.log(`API «Герои класса» слушает порт ${info.port} (TZ=${process.env.TZ ?? 'system'})`);
});
