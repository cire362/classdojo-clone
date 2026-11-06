import type { ReportReason } from '@heroes/shared';
import type { Moderation, ModerationActionKind, ReportedItem } from '@heroes/shared/api';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';

/**
 * Модерация ленты: родители жалуются на записи и комментарии, преподаватели группы скрывают их или оставляют.
 * Скрытое видят только преподаватели. Каждое действие попадает в журнал группы.
 */
export const AUTO_HIDE_REPORTS = 3;
const EXCERPT = 120;
const LOG_SIZE = 100;

export type Target = 'post' | 'comment';
type Db = Prisma.TransactionClient | typeof prisma;
export type Actor = { accountId: string | null; name: string };

const excerpt = (text: string) => (text.length > EXCERPT ? `${text.slice(0, EXCERPT - 1)}…` : text) || 'Без текста';

export async function logAction(
  db: Db,
  groupId: string,
  actor: Actor,
  action: ModerationActionKind,
  target: Target,
  item: { id: string; text: string },
) {
  await db.moderationAction.create({
    data: { groupId, actorId: actor.accountId, actorName: actor.name, action, target, targetId: item.id, excerpt: excerpt(item.text) },
  });
}

/** Запись или комментарий группы под блокировкой записи: жалобы и решения по ней идут по очереди */
async function lockedItem(tx: Prisma.TransactionClient, groupId: string, target: Target, id: string) {
  if (target === 'post') {
    const [post] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Post" WHERE id = ${id} AND "groupId" = ${groupId} FOR UPDATE`;
    if (!post) throw notFound('Запись не найдена');
    const row = await tx.post.findUniqueOrThrow({ where: { id }, select: { id: true, text: true, hiddenAt: true, createdAt: true } });
    return { ...row, postId: id, accountId: null as string | null, postHidden: row.hiddenAt };
  }
  const comment = await tx.postComment.findFirst({ where: { id, post: { groupId } }, select: { postId: true } });
  if (!comment) throw notFound('Комментарий не найден');
  await tx.$queryRaw`SELECT id FROM "Post" WHERE id = ${comment.postId} FOR UPDATE`;
  const row = await tx.postComment.findUniqueOrThrow({ where: { id }, include: { post: { select: { hiddenAt: true } } } });
  return { ...row, postHidden: row.post.hiddenAt };
}

/**
 * Жалоба родителя: один раз на запись или комментарий. Скрытое и ещё не вышедшее не видно, поэтому и жалобы на него нет.
 * После AUTO_HIDE_REPORTS жалоб разных родителей комментарий или запись скрываются до решения преподавателя.
 */
export async function reportContent(
  groupId: string,
  reporter: Actor & { accountId: string },
  target: { postId: string; commentId?: string },
  reason: ReportReason,
  note: string,
) {
  const kind: Target = target.commentId ? 'comment' : 'post';
  await prisma.$transaction(async (tx) => {
    const item = await lockedItem(tx, groupId, kind, target.commentId ?? target.postId);
    if (item.postId !== target.postId) throw notFound('Комментарий не найден');
    const visible = !item.hiddenAt && !item.postHidden && item.createdAt <= new Date();
    if (!visible) throw notFound(kind === 'post' ? 'Запись не найдена' : 'Комментарий не найден');
    if (item.accountId === reporter.accountId) throw new HttpError(400, 'На свой комментарий пожаловаться нельзя');
    const where = { reporterId: reporter.accountId, postId: target.postId, commentId: target.commentId ?? null };
    if (await tx.contentReport.findFirst({ where })) throw new HttpError(409, 'Вы уже пожаловались, преподаватель разберётся');
    await tx.contentReport.create({ data: { ...where, groupId, reason, note } });
    await logAction(tx, groupId, reporter, 'report', kind, item);
    const open = await tx.contentReport.count({ where: { postId: target.postId, commentId: target.commentId ?? null, resolvedAt: null } });
    if (open < AUTO_HIDE_REPORTS) return;
    await setHiddenAt(tx, kind, item.id, new Date());
    await logAction(tx, groupId, { accountId: null, name: 'Автоматически по жалобам' }, 'auto_hide', kind, item);
  });
}

function setHiddenAt(db: Db, target: Target, id: string, hiddenAt: Date | null) {
  return target === 'post'
    ? db.post.update({ where: { id }, data: { hiddenAt } })
    : db.postComment.update({ where: { id }, data: { hiddenAt } });
}

/**
 * Решение преподавателя: скрыть или показать. Открытые жалобы при этом закрываются; показ после жалоб
 * записывается в журнал как «оставлено».
 */
export async function setHidden(groupId: string, actor: Actor, target: Target, id: string, hidden: boolean) {
  await prisma.$transaction(async (tx) => {
    const item = await lockedItem(tx, groupId, target, id);
    const reports = { postId: item.postId, commentId: target === 'comment' ? id : null, resolvedAt: null };
    const { count } = await tx.contentReport.updateMany({ where: reports, data: { resolvedAt: new Date() } });
    await setHiddenAt(tx, target, id, hidden ? (item.hiddenAt ?? new Date()) : null);
    await logAction(tx, groupId, actor, hidden ? 'hide' : count ? 'keep' : 'unhide', target, item);
  });
}

/** Очередь жалоб (старые сверху: их ждут дольше) и последние действия журнала */
export async function groupModeration(groupId: string): Promise<Moderation> {
  const [open, log] = await Promise.all([
    prisma.contentReport.findMany({
      where: { groupId, resolvedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        post: { select: { id: true, text: true, createdAt: true, hiddenAt: true, author: { select: { name: true } } } },
        comment: { select: { id: true, text: true, createdAt: true, hiddenAt: true, authorName: true } },
      },
    }),
    prisma.moderationAction.findMany({ where: { groupId }, orderBy: { createdAt: 'desc' }, take: LOG_SIZE }),
  ]);
  const items = new Map<string, ReportedItem>();
  for (const r of open) {
    const c = r.comment;
    const key = c ? `comment:${c.id}` : `post:${r.post.id}`;
    const item = items.get(key) ?? {
      target: c ? 'comment' : 'post',
      id: c?.id ?? r.post.id,
      postId: r.post.id,
      author: c?.authorName ?? r.post.author.name,
      text: c?.text ?? r.post.text,
      createdAt: (c?.createdAt ?? r.post.createdAt).toISOString(),
      hidden: !!(c ? c.hiddenAt : r.post.hiddenAt),
      reasons: {},
      notes: [],
      reportedAt: r.createdAt.toISOString(),
    };
    const reason = r.reason as ReportReason;
    item.reasons[reason] = (item.reasons[reason] ?? 0) + 1;
    if (r.note) item.notes.push(r.note);
    items.set(key, item);
  }
  return {
    reports: [...items.values()],
    log: log.map((a) => ({
      id: a.id,
      action: a.action as ModerationActionKind,
      target: a.target as Target,
      actor: a.actorName,
      excerpt: a.excerpt,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
