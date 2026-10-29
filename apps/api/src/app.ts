import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { requireAuth, type AppEnv } from './auth.js';
import { prisma } from './db.js';
import { HttpError } from './lib/errors.js';
import { notifications } from './services/notifications.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { parentRoutes } from './routes/parent.js';
import { studentRoutes } from './routes/student.js';
import { teacherRoutes } from './routes/teacher.js';

export const CLIENT_HEADER = 'x-heroes-client';

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use('*', secureHeaders());

  // Защита от CSRF: кроме SameSite=Lax cookie, все изменяющие запросы должны нести
  // собственный заголовок. Чужой сайт не может его добавить без CORS-разрешения.
  app.use('/api/*', async (c, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && c.req.header(CLIENT_HEADER) !== '1') {
      throw new HttpError(403, 'Запрос отклонён');
    }
    await next();
  });

  app.get('/api/health', async (c) => {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ ok: true });
  });

  app.route('/api/auth', authRoutes);

  app.use('/api/admin/*', requireAuth);
  app.route('/api/admin', adminRoutes);

  app.use('/api/teacher/*', requireAuth);
  app.route('/api/teacher', teacherRoutes);

  app.use('/api/student/*', requireAuth);
  app.route('/api/student', studentRoutes);

  app.use('/api/parent/*', requireAuth);
  app.route('/api/parent', parentRoutes);

  app.get('/api/notifications', requireAuth, async (c) => c.json(await notifications(c.get('user'))));

  app.get('/api/hero-parts', requireAuth, async (c) => {
    const parts = await prisma.heroPart.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
    return c.json(parts.map((p) => ({ id: p.id, requiredLevel: p.requiredLevel, isPremium: p.isPremium })));
  });

  app.notFound((c) => c.json({ error: 'Не найдено' }, 404));

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status, err.headers);
    if (err instanceof HTTPException) return c.json({ error: err.message || 'Ошибка запроса' }, err.status);
    console.error(err);
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500);
  });

  return app;
}
