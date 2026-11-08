import { useCallback, useRef, useState } from 'react';
import { useGroup } from '../../groups';
import type { CardSummary, ClassGoal, Reason } from '../../../lib/api';
import { pluralize } from '../../../lib/hooks';
import { useToast } from '../../../ui/Toast';
import { awardPoints, fetchGoal, undoPoints } from '../api';
import { useTerms } from '../../auth';
import { currentSubject } from '../../../lib/subject';

export interface Burst {
  key: number;
  value: number;
  /** Если ученик перешёл на новый уровень — его номер */
  level?: number;
}

/** Начисление с отметкой на карточках, поздравлением и отменой из уведомления */
export function useAward(onAwarded: () => void) {
  const t = useTerms();
  const { data, setData } = useGroup();
  const toast = useToast();
  const [bursts, setBursts] = useState<Record<string, Burst>>({});
  const burstKey = useRef(1);
  const students = data.students;

  const applySummaries = useCallback(
    (summaries: Record<string, CardSummary>, classGoal?: ClassGoal | null) => {
      setData((current) => current && ({
        ...current,
        classGoal: classGoal === undefined ? current.classGoal : classGoal,
        students: current.students.map((s) => summaries[s.id] ? { ...s, ...summaries[s.id] } : s),
      }));
    },
    [setData],
  );

  async function award(ids: string[], reason: Reason) {
    try {
      const res = await awardPoints(data.group.id, ids, reason.id, currentSubject(data.group.id, data.subjects));
      const before = new Map(students.map((s) => [s.id, s.level]));
      applySummaries(res.summaries, res.classGoal);
      onAwarded();
      const leveled = ids.filter((id) => (res.summaries[id]?.level ?? 0) > (before.get(id) ?? 0));
      if (reason.value > 0) {
        const next: Record<string, Burst> = {};
        for (const id of ids) {
          const up = leveled.includes(id);
          next[id] = { key: burstKey.current++, value: reason.value, level: up ? res.summaries[id].level : undefined };
        }
        setBursts((b) => ({ ...b, ...next }));
      }
      if (leveled.length) {
        const names = leveled.map((id) => students.find((s) => s.id === id)?.name.split(' ')[0]).join(', ');
        toast({ text: `Новый уровень: ${names}!`, tone: 'ok' });
      }
      // На общем экране минусы не показываем: для списаний — нейтральное «Записано»
      const undo = {
        label: 'Отменить',
        run: async () => {
          try {
            const r = await undoPoints(res.eventIds);
            applySummaries(r.summaries);
            toast({ text: 'Отменено', tone: 'neutral' });
          } catch (err) {
            toast({ text: (err as Error).message, tone: 'error' });
            return;
          }
          try {
            // Цель могла быть изменена другим преподавателем после начисления.
            const goal = await fetchGoal(data.group.id);
            setData((current) => current && ({ ...current, classGoal: goal }));
          } catch {
            toast({ text: 'Баллы отменены. Чтобы обновить прогресс цели, перезагрузите страницу', tone: 'neutral' });
          }
        },
      };
      const who = ids.length === 1
        ? students.find((s) => s.id === ids[0])?.name.split(' ')[0]
        : `${ids.length} ${pluralize(ids.length, t.student.one.nom, t.student.one.gen, t.student.many.gen)}`;
      toast(
        reason.value > 0
          ? { text: `${who}: +${reason.value}, ${reason.name.toLowerCase()}`, tone: 'ok', action: undo }
          : { text: 'Записано', tone: 'neutral', action: undo },
      );
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    }
  }

  return { bursts, award };
}
