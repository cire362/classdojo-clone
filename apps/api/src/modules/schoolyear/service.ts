import type { SchoolYearPreview, SchoolYearResult } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { terms } from '../../platform/terms.js';
import { lockSchool } from '../access/index.js';

/**
 * Новый учебный год: действующие группы переходят на следующий курс (в школе — в следующий класс),
 * выпускные уходят в архив. Группы без курса не трогаются: администрация сначала задаёт им курс.
 */

/** Повторный переход раньше этого срока — скорее всего, двойное нажатие или ошибка */
const MIN_DAYS_BETWEEN = 120;

/** Номер курса в названии меняется, только если он записан отдельным числом: «5 «А»» → «6 «А»», «ИВТ-21» не меняется */
export function nextName(name: string, course: number) {
  const re = new RegExp(`(?<!\\d)${course}(?!\\d)`);
  return re.test(name) ? name.replace(re, String(course + 1)) : name;
}

const isRecent = (at: Date | null, now = new Date()) => !!at && now.getTime() - at.getTime() < MIN_DAYS_BETWEEN * 86_400_000;

const groupsOf = (schoolId: string) => ({ teacher: { schoolId }, archivedAt: null });

export async function schoolYearPreview(schoolId: string): Promise<SchoolYearPreview> {
  const [school, groups] = await Promise.all([
    prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { yearStartedAt: true } }),
    prisma.group.findMany({
      where: groupsOf(schoolId),
      orderBy: [{ course: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, course: true, _count: { select: { students: true } } },
    }),
  ]);
  const max = terms().maxCourse;
  return {
    lastStartedAt: school.yearStartedAt?.toISOString() ?? null,
    recent: isRecent(school.yearStartedAt),
    maxCourse: max,
    groups: groups
      .filter((g) => g.course)
      .map((g) => ({
        id: g.id,
        name: g.name,
        course: g.course!,
        students: g._count.students,
        nextName: nextName(g.name, g.course!),
        graduate: g.course! >= max,
      })),
    withoutCourse: groups.filter((g) => !g.course).map((g) => ({ id: g.id, name: g.name })),
  };
}

export async function startSchoolYear(
  schoolId: string,
  params: { graduateIds: string[]; rename: boolean; force: boolean },
): Promise<SchoolYearResult> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await lockSchool(tx, schoolId);
    const school = await tx.school.findUniqueOrThrow({ where: { id: schoolId }, select: { yearStartedAt: true } });
    if (!params.force && isRecent(school.yearStartedAt, now)) {
      throw new HttpError(409, 'Новый учебный год уже начинали недавно. Подтвердите повторный переход');
    }
    const groups = await tx.group.findMany({
      where: { ...groupsOf(schoolId), course: { not: null } },
      select: { id: true, name: true, course: true },
    });
    const known = new Set(groups.map((g) => g.id));
    const graduate = new Set(params.graduateIds);
    if ([...graduate].some((id) => !known.has(id))) throw notFound('Группа не найдена');
    const max = terms().maxCourse;
    let promoted = 0;
    let renamed = 0;
    for (const g of groups) {
      if (graduate.has(g.id)) continue;
      const course = g.course!;
      if (course >= max) continue;
      const name = params.rename ? nextName(g.name, course) : g.name;
      if (name !== g.name) renamed += 1;
      await tx.group.update({ where: { id: g.id }, data: { course: course + 1, name } });
      promoted += 1;
    }
    if (graduate.size) await tx.group.updateMany({ where: { id: { in: [...graduate] } }, data: { archivedAt: now } });
    await tx.school.update({ where: { id: schoolId }, data: { yearStartedAt: now } });
    return { promoted, graduated: graduate.size, renamed };
  });
}
