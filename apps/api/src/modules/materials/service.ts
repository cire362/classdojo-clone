import { randomUUID } from 'node:crypto';
import type { MaterialItem, MaterialKind } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';
import { env } from '../../platform/env.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { putBytes, readBytes, removeBytes, sizeOf } from '../../platform/storage.js';
import { detectFormat } from './formats.js';

/**
 * Методички: свои материалы преподавателя в Word, PDF, PowerPoint, Excel, OpenDocument, картинках и тексте.
 * Автор может открыть их коллегам своего учреждения. Смотреть можно на сайте, без скачивания:
 * документы Office показываются через PDF, который делает сервис просмотра.
 */
export const MAX_MATERIAL_BYTES = 25 * 1024 * 1024;

type Row = Awaited<ReturnType<typeof findRow>>;

const findRow = (id: string) =>
  prisma.material.findUnique({ where: { id }, include: { teacher: { select: { name: true } } } });

const view = (m: NonNullable<Row>, teacherId: string): MaterialItem => ({
  id: m.id,
  title: m.title,
  description: m.description,
  name: m.name,
  kind: m.kind as MaterialKind,
  size: m.size,
  shared: m.shared,
  mine: m.teacherId === teacherId,
  author: m.teacher?.name ?? 'Бывший преподаватель',
  createdAt: m.createdAt.toISOString(),
  viewable: !m.convert || !!m.previewKey,
});

/** Свои методички и открытые коллегами того же учреждения */
export async function listMaterials(teacherId: string, schoolId: string): Promise<MaterialItem[]> {
  const rows = await prisma.material.findMany({
    where: { schoolId, OR: [{ teacherId }, { shared: true }] },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { teacher: { select: { name: true } } },
  });
  return rows.map((m) => view(m, teacherId));
}

/** Методичка, которую преподаватель может открыть; чужая закрытая и из другого учреждения — 404 */
export async function readableMaterial(teacherId: string, schoolId: string, id: string) {
  const m = await findRow(id);
  if (!m || m.schoolId !== schoolId || (m.teacherId !== teacherId && !m.shared)) throw notFound('Методичка не найдена');
  return m;
}

async function ownMaterial(teacherId: string, schoolId: string, id: string) {
  const m = await readableMaterial(teacherId, schoolId, id);
  if (m.teacherId !== teacherId) throw new HttpError(403, 'Изменить методичку может только её автор');
  return m;
}

/** PDF для просмотра или null, если сервис просмотра недоступен или документ не открылся */
async function toPdf(bytes: Uint8Array, extension: string): Promise<Uint8Array | null> {
  if (!env.converterUrl) return null;
  try {
    const res = await fetch(`${env.converterUrl}/convert`, {
      method: 'POST',
      body: Buffer.from(bytes),
      headers: { 'Content-Type': 'application/octet-stream', 'X-Extension': extension },
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) return null;
    const pdf = new Uint8Array(await res.arrayBuffer());
    return Buffer.from(pdf.subarray(0, 5)).toString('latin1') === '%PDF-' ? pdf : null;
  } catch {
    return null;
  }
}

export async function addMaterial(
  teacherId: string,
  schoolId: string,
  file: File,
  data: { title: string; description: string; shared: boolean },
): Promise<MaterialItem> {
  if (file.size > MAX_MATERIAL_BYTES) throw new HttpError(413, 'Файл больше 25 МБ');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectFormat(bytes, file.name);
  if (!format) throw new HttpError(415, 'Подходят Word, PDF, PowerPoint, Excel, OpenDocument, RTF, картинки JPEG и PNG и текст');
  const fileKey = `material-${randomUUID()}`;
  await putBytes(fileKey, bytes);
  let previewKey: string | null = null;
  if (format.convert) {
    const pdf = await toPdf(bytes, format.convert);
    if (pdf) {
      previewKey = `${fileKey}-preview.pdf`;
      await putBytes(previewKey, pdf);
    }
  }
  const created = await prisma.material.create({
    data: {
      schoolId, teacherId, ...data, title: data.title || file.name.replace(/\.[^.]+$/, ''),
      name: file.name.slice(0, 200), mime: format.mime, kind: format.kind, size: bytes.length, fileKey, convert: format.convert, previewKey,
    },
    include: { teacher: { select: { name: true } } },
  });
  return view(created, teacherId);
}

export async function updateMaterial(
  teacherId: string,
  schoolId: string,
  id: string,
  data: { title: string; description: string; shared: boolean },
): Promise<MaterialItem> {
  await ownMaterial(teacherId, schoolId, id);
  const updated = await prisma.material.update({ where: { id }, data, include: { teacher: { select: { name: true } } } });
  return view(updated, teacherId);
}

export async function deleteMaterial(teacherId: string, schoolId: string, id: string) {
  const m = await ownMaterial(teacherId, schoolId, id);
  await prisma.material.delete({ where: { id } });
  await removeBytes(m.fileKey);
  if (m.previewKey) await removeBytes(m.previewKey);
}

/**
 * Что показать на странице: сам файл (PDF, картинка, текст) или его PDF-копию. Если копии ещё нет
 * (сервис просмотра был недоступен при загрузке), она делается сейчас
 */
export async function materialView(m: NonNullable<Row>) {
  if (!m.convert) return { key: m.fileKey, mime: m.mime, size: m.size };
  let previewKey = m.previewKey;
  if (!previewKey) {
    const pdf = await toPdf(await readBytes(m.fileKey), m.convert);
    if (!pdf) throw new HttpError(409, 'Просмотр пока недоступен. Скачайте файл');
    previewKey = `${m.fileKey}-preview.pdf`;
    await putBytes(previewKey, pdf);
    await prisma.material.update({ where: { id: m.id }, data: { previewKey } });
  }
  return { key: previewKey, mime: 'application/pdf', size: (await sizeOf(previewKey)) ?? 0 };
}
