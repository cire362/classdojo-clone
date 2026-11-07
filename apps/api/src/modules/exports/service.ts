import type { Prisma } from '../../generated/prisma/client.js';
import { dateKey } from '../../platform/dates.js';
import { cap } from '@heroes/shared/terms';
import { prisma } from '../../platform/db.js';
import { terms } from '../../platform/terms.js';
import type { ZipEntry } from './zip.js';

/**
 * Состав архивов. Родитель получает то же, что видит сам: опубликованную ленту группы ребёнка и вложения
 * своей переписки. Преподаватель и администратор школы — все файлы группы и её учеников.
 */
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf', 'video/mp4': 'mp4' };
const TITLE = 40;

/** Имя папки или файла без символов, которые запрещены в Windows и macOS */
const clean = (text: string, max = 80) =>
  text.replace(/[/\\:*?"<>|\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim().replace(/^\.+/, '');

const folder = (date: Date, text: string, fallback: string) => `${dateKey(date)} ${clean(text, TITLE) || fallback}`;

type Stored = { id: string; name: string; mime: string; position: number; createdAt: Date };

/** Пути в архиве: одинаковые имена получают номер, как при копировании в проводнике */
class Entries {
  private used = new Set<string>();
  readonly list: ZipEntry[] = [];

  add(path: string, date: Date, key: string) {
    let unique = path;
    for (let n = 2; this.used.has(unique.toLowerCase()); n++) unique = path.replace(/(\.[^./]+)?$/, ` (${n})$1`);
    this.used.add(unique.toLowerCase());
    this.list.push({ path: unique, date, key });
  }

  /** Фото и видео записи по порядку: 01.jpg, 02.mp4 */
  media(dir: string, file: Stored) {
    this.add(`${dir}/${String(file.position + 1).padStart(2, '0')}.${EXTENSIONS[file.mime] ?? 'bin'}`, file.createdAt, file.id);
  }

  named(dir: string, file: Stored, date = file.createdAt) {
    this.add(`${dir}/${clean(file.name) || 'файл'}`, date, file.id);
  }

  /** Пояснение в начале архива: что в нём и откуда. Заодно архив не бывает пустым */
  withReadme(text: string) {
    const readme = { path: 'Что в архиве.txt', date: new Date(), bytes: new TextEncoder().encode(`${text.trim()}\n`) };
    return [readme, ...this.list];
  }
}

const POST_FILES: { orderBy: Prisma.StoredFileOrderByWithRelationInput[] } = {
  orderBy: [{ post: { createdAt: 'asc' } }, { position: 'asc' }],
};

async function broadcastTitles(ids: string[]) {
  const messages = await prisma.message.findMany({ where: { broadcastId: { in: ids } }, distinct: ['broadcastId'] });
  return new Map(messages.map((m) => [m.broadcastId!, m]));
}

export async function groupArchive(groupId: string) {
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId }, select: { name: true } });
  const [posts, own, students] = await Promise.all([
    prisma.storedFile.findMany({ where: { groupId, postId: { not: null } }, include: { post: true }, ...POST_FILES }),
    prisma.storedFile.findMany({ where: { groupId, postId: null }, include: { assignment: true }, orderBy: { createdAt: 'asc' } }),
    prisma.storedFile.findMany({ where: { student: { groupId } }, include: { student: true, work: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  const entries = new Entries();
  for (const f of posts) entries.media(`Лента/${folder(f.post!.createdAt, f.post!.text, 'Запись')}`, f);
  const broadcasts = await broadcastTitles(own.flatMap((f) => (f.broadcastId ? [f.broadcastId] : [])));
  for (const f of own) {
    const message = f.broadcastId ? broadcasts.get(f.broadcastId) : undefined;
    if (message) entries.named(`Рассылки/${folder(message.createdAt, message.text, 'Рассылка')}`, f, message.createdAt);
    else if (f.assignment) entries.named(`Задания/${folder(f.assignment.createdAt, f.assignment.title, 'Задание')}`, f);
    else entries.named('Файлы группы', f);
  }
  const t = terms();
  for (const f of students) {
    const dir = `${cap(t.student.many.nom)}/${clean(f.student!.name) || cap(t.student.one.nom)}`;
    const kind = f.work?.assignmentId ? 'Задания' : 'Работы';
    entries.named(f.work ? `${dir}/${kind}/${folder(f.work.createdAt, f.work.title, 'Работа')}` : dir, f);
  }
  const readme = `
Фото, видео и файлы группы «${group.name}» на ${dateKey()}.
Лента — фото и видео записей, в том числе скрытых и запланированных.
Рассылки, Задания и Файлы группы — вложения рассылок родителям, файлы заданий и файлы для всей группы.
${cap(t.student.many.nom)} — вложения переписки с родителями, работы, ответы на задания и файлы каждого ${t.student.one.gen}, \
в том числе непроверенные.
Метаданные и геопозиция из фото и видео удалены при загрузке.`;
  return { name: group.name, entries: entries.withReadme(readme) };
}

/** Архив родителя: только то, что ему видно сейчас. Отложенное и скрытое не попадает */
export async function childArchive(studentId: string, parentId: string) {
  const now = new Date();
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { name: true, groupId: true } });
  const visible = { createdAt: { lte: now }, studentId, parentId };
  const received = await prisma.message.findMany({ where: { ...visible, broadcastId: { not: null } }, select: { broadcastId: true } });
  const [posts, attachments, broadcastFiles, works] = await Promise.all([
    prisma.storedFile.findMany({
      where: { groupId: student.groupId, post: { hiddenAt: null, createdAt: { lte: now } } },
      include: { post: true },
      ...POST_FILES,
    }),
    prisma.storedFile.findMany({ where: { message: visible }, include: { message: true }, orderBy: { createdAt: 'asc' } }),
    prisma.storedFile.findMany({ where: { broadcastId: { in: received.map((m) => m.broadcastId!) } }, orderBy: { createdAt: 'asc' } }),
    prisma.storedFile.findMany({
      where: { work: { studentId, status: 'APPROVED' } },
      include: { work: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  const entries = new Entries();
  const t = terms();
  const feed = `Лента ${t.group.one.gen}`;
  for (const f of posts) entries.media(`${feed}/${folder(f.post!.createdAt, f.post!.text, 'Запись')}`, f);
  const broadcasts = await broadcastTitles(broadcastFiles.map((f) => f.broadcastId!));
  const messages = [
    ...attachments.map((f) => ({ f, date: f.message!.createdAt })),
    ...broadcastFiles.map((f) => ({ f, date: broadcasts.get(f.broadcastId!)?.createdAt ?? f.createdAt })),
  ].sort((a, b) => +a.date - +b.date);
  for (const { f, date } of messages) entries.named(`Сообщения/${dateKey(date)}`, f, date);
  for (const f of works) entries.named(`Работы/${folder(f.work!.createdAt, f.work!.title, 'Работа')}`, f);
  const readme = `
Фото, видео и файлы для родителя ${t.student.one.gen} ${student.name} на ${dateKey()}.
${feed} — фото и видео опубликованных записей группы.
Сообщения — фото и файлы из переписки с преподавателями, по дням.
Работы — одобренные преподавателем работы ${t.student.one.gen}.
Метаданные и геопозиция из фото и видео удалены при загрузке.`;
  return { name: student.name, entries: entries.withReadme(readme) };
}
