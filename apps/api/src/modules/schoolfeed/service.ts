import type { AdminSchoolPost, SchoolPost } from '@heroes/shared/api';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthUser } from '../../platform/auth.js';
import { prisma } from '../../platform/db.js';
import { env } from '../../platform/env.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { lockSchool, schoolsOf } from '../access/index.js';
import { fileView, prepareUpload, purgeDeletedFiles, writeUploads, type Upload } from '../files/index.js';

/**
 * Лента школы: записи директора и завуча для преподавателей школы и семей её учеников. Реакций и комментариев
 * нет: это канал объявлений, а обсуждение идёт в ленте класса и в сообщениях.
 */
export const MAX_SCHOOL_POST_FILES = 5;
/** Последние записи; старые новости школы искать в ленте не нужно */
const PAGE = 50;

const INCLUDE = {
  files: { orderBy: { position: 'asc' } },
  school: { select: { name: true } },
} as const satisfies Prisma.SchoolPostInclude;

type Loaded = Prisma.SchoolPostGetPayload<{ include: typeof INCLUDE }>;

const base = (p: Loaded) => ({
  id: p.id,
  schoolName: p.school.name,
  author: p.authorName,
  text: p.text,
  important: p.important,
  createdAt: p.createdAt.toISOString(),
  files: p.files.map(fileView),
});

/** Записи для чтения. Просмотр отмечает ленту прочитанной: unread показывает, что было новым до него */
export async function readSchoolFeed(user: AuthUser): Promise<SchoolPost[]> {
  const schoolIds = await schoolsOf(user);
  if (!schoolIds.length) return [];
  const [posts, reads] = await Promise.all([
    prisma.schoolPost.findMany({
      where: { schoolId: { in: schoolIds } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE,
      include: INCLUDE,
    }),
    prisma.schoolFeedRead.findMany({ where: { accountId: user.accountId, schoolId: { in: schoolIds } } }),
  ]);
  const seenAt = new Map(reads.map((r) => [r.schoolId, r.seenAt]));
  const now = new Date();
  await prisma.$transaction(schoolIds.map((schoolId) => prisma.schoolFeedRead.upsert({
    where: { accountId_schoolId: { accountId: user.accountId, schoolId } },
    create: { accountId: user.accountId, schoolId, seenAt: now },
    update: { seenAt: now },
  })));
  return posts.map((p) => {
    const seen = seenAt.get(p.schoolId);
    return { ...base(p), unread: !seen || p.createdAt > seen };
  });
}

/** Новых записей для значка в шапке */
export async function unreadSchoolPosts(user: AuthUser): Promise<number> {
  const schoolIds = await schoolsOf(user);
  if (!schoolIds.length) return 0;
  const reads = await prisma.schoolFeedRead.findMany({ where: { accountId: user.accountId, schoolId: { in: schoolIds } } });
  const seenAt = new Map(reads.map((r) => [r.schoolId, r.seenAt]));
  const after = (schoolId: string) => (seenAt.has(schoolId) ? { createdAt: { gt: seenAt.get(schoolId)! } } : {});
  return prisma.schoolPost.count({ where: { OR: schoolIds.map((schoolId) => ({ schoolId, ...after(schoolId) })) } });
}

/** Семьи школы: входы родителей, чьи дети учатся в действующих группах её преподавателей */
const familiesOf = (schoolId: string): Prisma.AccountWhereInput => ({
  parent: { children: { some: { student: { group: { archivedAt: null, teacher: { schoolId } } } } } },
});

/** Записи для панели школы; у объявления — сколько семей открыли ленту после его публикации */
export async function adminSchoolFeed(schoolId: string): Promise<AdminSchoolPost[]> {
  const posts = await prisma.schoolPost.findMany({
    where: { schoolId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE,
    include: INCLUDE,
  });
  const families = posts.some((p) => p.important) ? await prisma.account.count({ where: familiesOf(schoolId) }) : 0;
  return Promise.all(posts.map(async (p) => {
    if (!p.important) return { ...base(p), reach: null };
    const read = await prisma.account.count({
      where: { ...familiesOf(schoolId), schoolFeedReads: { some: { schoolId, seenAt: { gte: p.createdAt } } } },
    });
    return { ...base(p), reach: { read, families } };
  }));
}

/** Запись с файлами создаётся целиком или никак: при сбое записи на диск она удаляется */
export async function createSchoolPost(user: AuthUser, input: { text: string; important: boolean }, files: File[]) {
  if (files.length > MAX_SCHOOL_POST_FILES) throw new HttpError(400, `К записи можно приложить не больше ${MAX_SCHOOL_POST_FILES} файлов`);
  if (!input.text && !files.length) throw new HttpError(400, 'Напишите текст или приложите файл');
  const schoolId = user.schoolId!;
  const uploads: Upload[] = [];
  for (const file of files) uploads.push(await prepareUpload(file));
  const { post, rows } = await prisma.$transaction(async (tx) => {
    await lockSchool(tx, schoolId);
    const { _sum } = await tx.storedFile.aggregate({ where: { schoolPost: { schoolId } }, _sum: { size: true } });
    const adding = uploads.reduce((sum, u) => sum + u.bytes.length, 0);
    if ((_sum.size ?? 0) + adding > env.groupFilesQuota) throw new HttpError(409, 'Место для файлов ленты школы закончилось');
    const post = await tx.schoolPost.create({
      data: { schoolId, authorId: user.accountId, authorName: user.name, text: input.text, important: input.important },
    });
    const rows = [];
    for (const [position, u] of uploads.entries()) {
      rows.push(await tx.storedFile.create({
        data: { schoolPostId: post.id, position, uploadedById: user.accountId, name: u.name, mime: u.mime, size: u.bytes.length },
      }));
    }
    return { post, rows };
  });
  try {
    await writeUploads(rows, uploads);
  } catch (err) {
    await prisma.schoolPost.delete({ where: { id: post.id } });
    await purgeDeletedFiles();
    throw err;
  }
  return adminSchoolFeed(schoolId);
}

/** Удаление уносит файлы записи */
export async function deleteSchoolPost(schoolId: string, postId: string) {
  const { count } = await prisma.schoolPost.deleteMany({ where: { id: postId, schoolId } });
  if (!count) throw notFound('Запись не найдена');
  await purgeDeletedFiles();
  return adminSchoolFeed(schoolId);
}
