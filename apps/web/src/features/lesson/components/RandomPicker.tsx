import { useEffect, useMemo, useState } from 'react';
import { DiceFiveIcon } from '@phosphor-icons/react';
import { HeroAvatar } from '../../hero';
import type { LessonStudent } from '../../../lib/api';
import { Modal } from '../../../ui';
import { useTerms } from '../../auth';

export function RandomPicker({
  open,
  students,
  onlyPresent,
  onClose,
  onAward,
}: {
  open: boolean;
  students: LessonStudent[];
  onlyPresent: boolean;
  onClose: () => void;
  onAward: (s: LessonStudent) => void;
}) {
  const t = useTerms();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [run, setRun] = useState(0);
  const order = useMemo(() => students.map((_, i) => i).sort(() => Math.random() - 0.5), [students, run]);

  useEffect(() => {
    if (!open || !students.length) return;
    setDone(false);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = reduce ? 1 : 14 + Math.floor(Math.random() * 6);
    const timers: number[] = [];
    let t = 0;
    for (let i = 0; i < steps; i++) {
      t += 60 + i * i * 2.2; // замедление к концу
      timers.push(window.setTimeout(() => setIndex(order[i % order.length]), t));
    }
    timers.push(window.setTimeout(() => setDone(true), t + 80));
    return () => timers.forEach(clearTimeout);
  }, [open, run, order, students.length]);

  const s = students[index];
  return (
    <Modal open={open} title={onlyPresent ? 'Случайный из присутствующих' : `Случайный ${t.student.one.nom}`} onClose={onClose}>
      {s && (
        <div className="flex flex-col items-center text-center">
          <div
            key={done ? 'done' : s.id}
            className={`w-48 rounded-2xl p-2 transition-colors ${done ? 'anim-pop-big bg-accent/30' : 'bg-surface-2'}`}
          >
            <HeroAvatar parts={s.hero.parts} level={s.level} className="aspect-[5/6]" />
          </div>
          <p className={`mt-4 font-display text-2xl transition-opacity ${done ? '' : 'opacity-60'}`}>{s.name}</p>
          <div className={`mt-6 flex flex-wrap justify-center gap-2 transition-opacity ${done ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
            <button className="btn btn-primary" onClick={() => onAward(s)}>
              Начислить баллы
            </button>
            <button className="btn btn-secondary" onClick={() => setRun((r) => r + 1)}>
              <DiceFiveIcon size={20} /> Ещё раз
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
