import { Hono, type Context } from 'hono';
import { requireRole, type AppEnv } from '../../platform/auth.js';
import { dateKey } from '../../platform/dates.js';
import { prisma } from '../../platform/db.js';
import { notFound } from '../../platform/errors.js';
import { parentChild, teacherGroup } from '../access/index.js';
import { childArchive, groupArchive } from './service.js';
import { zipStream, type ZipEntry } from './zip.js';

/** Архив скачивается обычной ссылкой: GET без своего заголовка, вход проверяет cookie */
async function download(c: Context<AppEnv>, archive: { name: string; entries: ZipEntry[] }) {
  const filename = `Герои класса — ${archive.name} — ${dateKey()}.zip`.replace(/[/\\:*?"<>|]/g, ' ');
  return new Response(await zipStream(archive.entries), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** Все файлы группы для любого её преподавателя, в том числе в архиве. Роль проверяет routes/teacher.ts */
export const teacherExportRoutes = new Hono<AppEnv>().get('/groups/:id/export', async (c) => {
  const group = await teacherGroup(c.get('user'), c.req.param('id'));
  return download(c, await groupArchive(group.id));
});

/** Файлы ребёнка глазами родителя. Роль проверяет routes/parent.ts */
export const parentExportRoutes = new Hono<AppEnv>().get('/children/:id/export', async (c) => {
  const studentId = await parentChild(c.get('user').parentId!, c.req.param('id'));
  return download(c, await childArchive(studentId, c.get('user').parentId!));
});

/** Администратор школы выгружает файлы любой группы своей школы, например перед удалением по сроку хранения */
export const adminExportRoutes = new Hono<AppEnv>().use(requireRole('ADMIN')).get('/groups/:id/export', async (c) => {
  const where = { id: c.req.param('id'), teacher: { schoolId: c.get('user').schoolId ?? '' } };
  const group = await prisma.group.findFirst({ where, select: { id: true } });
  if (!group) throw notFound('Группа не найдена');
  return download(c, await groupArchive(group.id));
});
