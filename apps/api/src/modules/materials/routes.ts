import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { HttpError, parse } from '../../platform/errors.js';
import { streamBytes } from '../../platform/storage.js';
import {
  MAX_MATERIAL_BYTES, addMaterial, deleteMaterial, listMaterials, materialView, readableMaterial, updateMaterial,
} from './service.js';

const Meta = z.object({
  title: z.string().trim().max(120),
  description: z.string().trim().max(1000).default(''),
  shared: z.boolean(),
});

/** Картинки и текст показываются без скриптов и внешних ресурсов */
const STRICT_CSP = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'";
const who = (c: Context<AppEnv>) => ({ teacherId: c.get('user').teacherId!, schoolId: c.get('user').schoolId! });
const disposition = (kind: 'inline' | 'attachment', name: string) => `${kind}; filename*=UTF-8''${encodeURIComponent(name)}`;

/** Методички преподавателя. Роль проверяет сборка routes/teacher.ts */
export const teacherMaterialRoutes = new Hono<AppEnv>()
  .get('/materials', async (c) => {
    const { teacherId, schoolId } = who(c);
    return c.json(await listMaterials(teacherId, schoolId));
  })
  .post(
    '/materials',
    bodyLimit({
      maxSize: MAX_MATERIAL_BYTES + 64 * 1024,
      onError: () => {
        throw new HttpError(413, 'Файл больше 25 МБ');
      },
    }),
    async (c) => {
      const { teacherId, schoolId } = who(c);
      const body = await c.req.parseBody();
      const file = body['file'];
      if (!(file instanceof File)) throw new HttpError(400, 'Выберите файл');
      const meta = parse(Meta, {
        title: String(body['title'] ?? ''),
        description: String(body['description'] ?? ''),
        shared: body['shared'] === 'true',
      });
      return c.json(await addMaterial(teacherId, schoolId, file, meta), 201);
    },
  )
  .patch('/materials/:id', async (c) => {
    const { teacherId, schoolId } = who(c);
    const Patch = Meta.extend({ title: z.string().trim().min(1, 'Введите название').max(120) });
    const meta = parse(Patch, await c.req.json().catch(() => null));
    return c.json(await updateMaterial(teacherId, schoolId, c.req.param('id'), meta));
  })
  .delete('/materials/:id', async (c) => {
    const { teacherId, schoolId } = who(c);
    await deleteMaterial(teacherId, schoolId, c.req.param('id'));
    return c.json({ ok: true });
  })
  // Просмотр на странице: PDF, картинка, текст или PDF-копия документа Office
  .get('/materials/:id/view', async (c) => {
    const { teacherId, schoolId } = who(c);
    const m = await readableMaterial(teacherId, schoolId, c.req.param('id'));
    const { key, mime, size } = await materialView(m);
    return new Response(streamBytes(key), {
      headers: {
        'Content-Type': mime,
        'Content-Length': String(size),
        'Content-Disposition': disposition('inline', m.convert ? `${m.name.replace(/\.[^.]+$/, '')}.pdf` : m.name),
        'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
        // PDF показывает встроенный просмотрщик браузера: запрет скриптов в песочнице его бы выключил
        ...(mime === 'application/pdf' ? {} : { 'Content-Security-Policy': STRICT_CSP }),
      },
    });
  })
  .get('/materials/:id/file', async (c) => {
    const { teacherId, schoolId } = who(c);
    const m = await readableMaterial(teacherId, schoolId, c.req.param('id'));
    return new Response(streamBytes(m.fileKey), {
      headers: {
        'Content-Type': m.mime,
        'Content-Length': String(m.size),
        'Content-Disposition': disposition('attachment', m.name),
        'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
