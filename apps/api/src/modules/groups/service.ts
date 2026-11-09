import { normalizeHero } from '@heroes/shared';
import type { GroupDetails, GroupListItem } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';
import { env } from '../../platform/env.js';
import { groupsOf } from '../access/index.js';
import { todayAttendance } from '../attendance/index.js';
import { filesExpireAt } from '../files/index.js';
import { classGoal } from '../goals/index.js';
import { deleteOrphanParents, revokeGroupInvites } from '../parents/index.js';
import { lessonPlan } from '../plan/index.js';
import { cardSummaries } from '../points/index.js';
import { createDefaultReasons, manualReasons } from '../reasons/index.js';
import { createDefaultRewards, pendingRequestCount } from '../rewards/index.js';
import { groupTeams } from '../teams/index.js';
import { pendingWorkCount } from '../works/index.js';
import { pendingAnswerCount } from '../assignments/index.js';
import { groupSubjects } from '../subjects/index.js';

type OwnedGroup = {
  id: string; name: string; subtractTeacher: boolean; feedComments: boolean; parentsEnabled: boolean; heroes: boolean;
  archivedAt: Date | null; isOwner: boolean;
};

export async function teacherGroups(teacherId: string): Promise<GroupListItem[]> {
  const groups = await prisma.group.findMany({
    where: groupsOf(teacherId),
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { students: true } },
      students: { take: 6, orderBy: { name: 'asc' }, select: { hero: { select: { parts: true } } } },
      teacher: { select: { name: true } },
      coTeachers: { orderBy: { createdAt: 'asc' }, select: { teacher: { select: { id: true, name: true } } } },
    },
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    subtractTeacher: g.subtractTeacher,
    archivedAt: g.archivedAt?.toISOString() ?? null,
    studentsCount: g._count.students,
    previewHeroes: g.students.map((s) => normalizeHero(s.hero?.parts)),
    isOwner: g.teacherId === teacherId,
    // Другие преподаватели группы — подпись «вместе с …» на карточке
    colleagues: [
      ...(g.teacherId === teacherId ? [] : [g.teacher.name]),
      ...g.coTeachers.filter((ct) => ct.teacher.id !== teacherId).map((ct) => ct.teacher.name),
    ],
  }));
}

export async function createGroup(teacherId: string, name: string): Promise<Omit<GroupListItem, 'isOwner' | 'colleagues'>> {
  const group = await prisma.$transaction(async (tx) => {
    // Студенты колледжа и вуза совершеннолетние: родители в их группах по умолчанию выключены
    const select = { school: { select: { kind: true, heroes: true } } };
    const { school } = await tx.teacher.findUniqueOrThrow({ where: { id: teacherId }, select });
    const g = await tx.group.create({ data: { name, teacherId, parentsEnabled: school.kind === 'SCHOOL', heroes: school.heroes } });
    await createDefaultReasons(tx, g.id);
    await createDefaultRewards(tx, g.id);
    return g;
  });
  return { id: group.id, name: group.name, subtractTeacher: group.subtractTeacher, archivedAt: null, studentsCount: 0, previewHeroes: [] };
}

/** teacherId — кто смотрит: счётчик работ считает адресованные ему */
export async function groupDetails(group: OwnedGroup, teacherId: string): Promise<GroupDetails> {
  const [students, reasons, today] = await Promise.all([
    prisma.student.findMany({
      where: { groupId: group.id },
      orderBy: { name: 'asc' },
      include: { hero: true, account: { select: { login: true } }, _count: { select: { parents: true } } },
    }),
    manualReasons(group.id),
    todayAttendance(group.id),
  ]);
  const [summaries, teams, pendingRewards, pendingWorks, pendingAnswers, goal, plan, subjects] = await Promise.all([
    cardSummaries(students.map((s) => s.id)),
    groupTeams(group.id),
    pendingRequestCount(group.id),
    pendingWorkCount(group.id, teacherId),
    pendingAnswerCount(group.id),
    classGoal(group.id),
    lessonPlan(group.id),
    groupSubjects(group.id),
  ]);
  return {
    group: {
      id: group.id,
      name: group.name,
      subtractTeacher: group.subtractTeacher,
      feedComments: group.feedComments,
      parentsEnabled: group.parentsEnabled,
      heroes: group.heroes,
      archivedAt: group.archivedAt?.toISOString() ?? null,
      isOwner: group.isOwner,
      filesExpireAt: filesExpireAt(group.archivedAt)?.toISOString() ?? null,
      filesKeptDays: env.archivedFilesDays,
    },
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      login: s.account.login,
      hero: { name: s.hero?.name ?? '', parts: normalizeHero(s.hero?.parts) },
      parentsCount: s._count.parents,
      teamId: s.teamId,
      noPhotos: s.noPhotos,
      ...summaries.get(s.id)!,
    })),
    reasons,
    teams,
    classGoal: goal,
    subjects,
    plan,
    pendingRewards,
    pendingWorks,
    pendingAnswers,
    todayAttendance: today,
  };
}

/** Выключение родителей отзывает действующие приглашения: по ним нельзя было бы войти. Выданные входы остаются */
export async function updateGroup(
  groupId: string,
  data: { name?: string; subtractTeacher?: boolean; feedComments?: boolean; parentsEnabled?: boolean; heroes?: boolean },
) {
  const g = await prisma.group.update({ where: { id: groupId }, data });
  if (data.parentsEnabled === false) await revokeGroupInvites(groupId);
  return {
    id: g.id, name: g.name, subtractTeacher: g.subtractTeacher, feedComments: g.feedComments,
    parentsEnabled: g.parentsEnabled, heroes: g.heroes,
  };
}

/** Архив: группа скрывается из списка и замораживается (просмотр, статистика и Excel остаются) */
export async function archiveGroup(groupId: string, archivedAt: Date | null) {
  const g = await prisma.group.update({ where: { id: groupId }, data: { archivedAt: archivedAt ?? new Date() } });
  return { id: g.id, archivedAt: g.archivedAt?.toISOString() ?? null };
}

export async function restoreGroup(groupId: string) {
  await prisma.group.update({ where: { id: groupId }, data: { archivedAt: null } });
  return { id: groupId, archivedAt: null };
}

export async function deleteGroup(groupId: string) {
  const students = await prisma.student.findMany({ where: { groupId }, select: { accountId: true } });
  await prisma.$transaction([
    prisma.account.deleteMany({ where: { id: { in: students.map((s) => s.accountId) } } }),
    prisma.group.delete({ where: { id: groupId } }),
    deleteOrphanParents(),
  ]);
}
