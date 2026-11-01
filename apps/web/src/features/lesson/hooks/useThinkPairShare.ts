import { useEffect, useState } from 'react';
import { COUNTDOWN_KEY, LAST_STAGE, PLAN_KEY, defaultPlan, restorePlan, type Plan } from '../think-pair-share';
import { useLessonTimer } from './useLessonTimer';

const EXTRA_MS = 60_000;

/** Этапы идут по команде преподавателя: по окончании отсчёт останавливается, обсуждение редко укладывается ровно в срок. */
export function useThinkPairShare(groupId: string) {
  const key = PLAN_KEY + groupId;
  const countdown = useLessonTimer(groupId, COUNTDOWN_KEY);
  const [plan, setPlan] = useState<Plan>(() => {
    try { return restorePlan(sessionStorage.getItem(key)); }
    catch { return defaultPlan(); }
  });

  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(plan)); }
    catch { /* Без хранилища этапы работают до закрытия страницы. */ }
  }, [key, plan]);

  function start(minutes: number[]) {
    setPlan({ version: 1, stage: 0, minutes });
    countdown.start(minutes[0] * 60_000);
  }
  function next() {
    if (plan.stage === LAST_STAGE) return;
    const stage = plan.stage + 1;
    setPlan({ ...plan, stage });
    countdown.start(plan.minutes[stage] * 60_000);
  }
  function reset() {
    setPlan({ ...plan, stage: 0 });
    countdown.configure(plan.minutes[0] * 60_000);
  }

  return {
    timer: countdown.timer,
    remaining: countdown.remaining,
    stage: plan.stage,
    minutes: plan.minutes,
    active: countdown.timer.status !== 'idle',
    pause: countdown.pause,
    resume: countdown.resume,
    extend: () => countdown.start(EXTRA_MS),
    start,
    next,
    reset,
  };
}
