import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { requireAuth, type AppEnv } from './platform/auth.js';
import { prisma } from './platform/db.js';
import { HttpError } from './platform/errors.js';
import { notifications } from './modules/notifications/index.js';
import { adminRoutes, authRoutes, schoolJoinRoutes, schoolStaffRoutes } from './modules/accounts/index.js';
import { codeLoginRoutes } from './modules/codes/index.js';
import { adminExportRoutes } from './modules/exports/index.js';
import { fileRoutes } from './modules/files/index.js';
import { activeHeroParts } from './modules/hero/index.js';
import { inviteRoutes } from './modules/parents/index.js';
import { parentRoutes } from './routes/parent.js';
import { studentRoutes } from './routes/student.js';
import { adminSchoolFeedRoutes, schoolFeedRoutes } from './modules/schoolfeed/index.js';
import { adminSchoolInboxRoutes } from './modules/schoolinbox/index.js';
import { adminSchoolPointsRoutes } from './modules/schoolpoints/index.js';
import { adminReasonRoutes } from './modules/reasons/index.js';
import { adminDepartmentRoutes } from './modules/departments/index.js';
import { adminSubjectRoutes } from './modules/subjects/index.js';
import { adminDashboardRoutes } from './modules/dashboard/index.js';
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
  app.route('/api/auth', codeLoginRoutes);
  app.route('/api/auth', inviteRoutes);
  app.route('/api/auth', schoolJoinRoutes);

  app.use('/api/admin/*', requireAuth);
  app.route('/api/admin', adminRoutes);
  app.route('/api/admin', schoolStaffRoutes);
  app.route('/api/admin', adminExportRoutes);
  app.route('/api/admin', adminSchoolFeedRoutes);
  app.route('/api/admin', adminSchoolInboxRoutes);
  app.route('/api/admin', adminSchoolPointsRoutes);
  app.route('/api/admin', adminReasonRoutes);
  app.route('/api/admin', adminDepartmentRoutes);
  app.route('/api/admin', adminSubjectRoutes);
  app.route('/api/admin', adminDashboardRoutes);

  app.use('/api/teacher/*', requireAuth);
  app.route('/api/teacher', teacherRoutes);

  app.use('/api/student/*', requireAuth);
  app.route('/api/student', studentRoutes);

  app.use('/api/parent/*', requireAuth);
  app.route('/api/parent', parentRoutes);

  app.use('/api/school-feed', requireAuth);
  app.route('/api/school-feed', schoolFeedRoutes);

  app.use('/api/files/*', requireAuth);
  app.route('/api/files', fileRoutes);

  app.get('/api/notifications', requireAuth, async (c) => c.json(await notifications(c.get('user'))));

  app.get('/api/hero-parts', requireAuth, async (c) => c.json(await activeHeroParts()));

  app.notFound((c) => c.json({ error: 'Не найдено' }, 404));

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status, err.headers);
    if (err instanceof HTTPException) return c.json({ error: err.message || 'Ошибка запроса' }, err.status);
    console.error(err);
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500);
  });

  return app;
}
