import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../platform/db.js';
import { HttpError } from '../platform/errors.js';
import { markFeedRead } from './feed.js';

const PAGE = 30;
type Kind = 'feed' | 'reward';
type Cursor = { at: Date; kind: Kind; id: string };

function snapshot(value?: string): Date {
  const date = value ? new Date(value) : new Date();
  if (!Number.isFinite(+date) || +date > Date.now()) throw new HttpError(400, 'Некорректное время просмотра');
  return date;
}

function parseCursor(value?: string): Cursor | null {
  if (!value) return null;
  const [time, kind, id, extra] = value.split('|');
  const at = new Date(time);
  if (!Number.isFinite(+at) || !id || !['feed', 'reward'].includes(kind) || extra !== undefined) {
    throw new HttpError(400, 'Некорректная страница уведомлений');
  }
  return { at, kind: kind as Kind, id };
}

/** Оба источника сортируются по времени, виду и id. Равное время не теряет события между страницами. */
function before(field: 'createdAt' | 'decidedAt', kind: Kind, cursor: Cursor | null) {
  if (!cursor) return {};
  return { OR: [
    { [field]: { lt: cursor.at } },
    ...(kind < cursor.kind ? [{ [field]: cursor.at }]
      : kind === cursor.kind ? [{ [field]: cursor.at, id: { lt: cursor.id } }] : []),
  ] };
}

export async function unreadRewards(studentId: string, readAt: Date) {
  return prisma.rewardRequest.count({ where: { studentId, status: 'APPROVED', decidedAt: { gt: readAt } } });
}

export async function markRewardNotificationsRead(studentId: string, through: Date, db: Prisma.TransactionClient | typeof prisma = prisma) {
  await db.student.updateMany({ where: { id: studentId, rewardsReadAt: { lt: through } }, data: { rewardsReadAt: through } });
}

/** Уведомления выводятся из исходных событий: удалённые объявления исчезают, чужие группы не попадают. */
export async function studentNotifications(studentId: string, query: { before?: string; through?: string } = {}) {
  const through = snapshot(query.through);
  const cursor = parseCursor(query.before);
  const s = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { accountId: true, groupId: true, rewardsReadAt: true } });
  const read = await prisma.feedRead.findUnique({ where: { accountId_groupId: { accountId: s.accountId, groupId: s.groupId } } });
  const [posts, rewards, feedUnread, rewardUnread] = await Promise.all([
    prisma.post.findMany({
      where: { groupId: s.groupId, createdAt: { lte: through }, ...before('createdAt', 'feed', cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: PAGE + 1,
      select: { id: true, text: true, createdAt: true, author: { select: { name: true } } },
    }),
    prisma.rewardRequest.findMany({
      where: { studentId, status: 'APPROVED', decidedAt: { not: null, lte: through }, ...before('decidedAt', 'reward', cursor) },
      orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }], take: PAGE + 1,
      select: { id: true, title: true, cost: true, decidedAt: true, decidedBy: { select: { teacher: { select: { name: true } } } } },
    }),
    prisma.post.count({ where: { groupId: s.groupId, createdAt: { lte: through, ...(read ? { gt: read.readAt } : {}) } } }),
    prisma.rewardRequest.count({ where: { studentId, status: 'APPROVED', decidedAt: { gt: s.rewardsReadAt, lte: through } } }),
  ]);
  const items = [
    ...posts.map((p) => ({ id: `feed:${p.id}`, kind: 'feed' as const, title: 'Запись в ленте класса', text: p.text, author: p.author.name, cost: null as number | null, createdAt: p.createdAt, unread: !read || p.createdAt > read.readAt, href: '/feed' as const, cursor: `${p.createdAt.toISOString()}|feed|${p.id}` })),
    ...rewards.map((r) => ({ id: `reward:${r.id}`, kind: 'reward' as const, title: 'Награда выдана', text: r.title, author: r.decidedBy?.teacher?.name ?? null, cost: r.cost, createdAt: r.decidedAt!, unread: r.decidedAt! > s.rewardsReadAt, href: '/shop' as const, cursor: `${r.decidedAt!.toISOString()}|reward|${r.id}` })),
  ].sort((a, b) => a.cursor < b.cursor ? 1 : a.cursor > b.cursor ? -1 : 0);
  const page = items.slice(0, PAGE);
  return {
    items: page.map(({ cursor: _, ...item }) => item),
    nextCursor: items.length > PAGE ? page.at(-1)!.cursor : null,
    through: through.toISOString(), groupId: s.groupId, unreadCount: feedUnread + rewardUnread,
  };
}

/** Отметка всей коллекции на момент её загрузки; свежие события и отметки другого устройства не затираются. */
export async function readStudentNotifications(studentId: string, groupId: string, value: string) {
  const through = snapshot(value);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${studentId} FOR UPDATE`;
    const s = await tx.student.findUniqueOrThrow({ where: { id: studentId }, select: { groupId: true, accountId: true } });
    if (s.groupId !== groupId) throw new HttpError(409, 'Группа изменилась. Обнови уведомления');
    await markFeedRead(s.accountId, s.groupId, through, tx);
    await markRewardNotificationsRead(studentId, through, tx);
  });
}
