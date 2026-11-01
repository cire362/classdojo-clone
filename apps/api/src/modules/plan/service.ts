import type { LessonPlan } from '@heroes/shared/api';
import { prisma } from '../../platform/db.js';
import { HttpError } from '../../platform/errors.js';
import { lockGroup } from '../access/index.js';

const view = (plan: { steps: unknown; current: number }): LessonPlan => ({ steps: plan.steps as string[], current: plan.current });

export async function lessonPlan(groupId: string): Promise<LessonPlan> {
  const plan = await prisma.lessonPlan.findUnique({ where: { groupId } });
  return plan ? view(plan) : { steps: [], current: 0 };
}

/** Правка во время урока не сбивает экран: текущим остаётся тот же шаг, даже если он сдвинулся. Пустой список удаляет план. */
export async function savePlanSteps(groupId: string, steps: string[]): Promise<LessonPlan> {
  return prisma.$transaction(async (tx) => {
    await lockGroup(tx, groupId);
    if (!steps.length) {
      await tx.lessonPlan.deleteMany({ where: { groupId } });
      return { steps: [], current: 0 };
    }
    const saved = await tx.lessonPlan.findUnique({ where: { groupId } });
    const moved = saved ? steps.indexOf(view(saved).steps[saved.current]) : -1;
    const current = moved >= 0 ? moved : Math.min(saved?.current ?? 0, steps.length - 1);
    return view(await tx.lessonPlan.upsert({ where: { groupId }, create: { groupId, steps, current }, update: { steps, current } }));
  });
}

export async function setPlanStep(groupId: string, current: number): Promise<LessonPlan> {
  return prisma.$transaction(async (tx) => {
    await lockGroup(tx, groupId);
    const saved = await tx.lessonPlan.findUnique({ where: { groupId } });
    if (!saved || current >= view(saved).steps.length) throw new HttpError(409, 'План изменился, обновите страницу');
    return view(await tx.lessonPlan.update({ where: { groupId }, data: { current } }));
  });
}
