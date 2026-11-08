import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, UsersThreeIcon } from '@phosphor-icons/react';
import type { Reason, StreamItem } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { HeroHead } from '../../hero';
import { ReasonPicker } from '../../lesson';
import { awardStream, fetchStreamBoard } from '../api';
import { StreamAttendance } from './StreamAttendance';

type Target = { label: string; ids: string[] } | null;

/** Подпись потока: дисциплина и группы */
export const streamCaption = (s: StreamItem) => [s.subject?.name, s.groups.map((g) => g.name).join(', ')].filter(Boolean).join(' · ');

/** Занятие потока: ученики всех групп на одном экране, баллы и отметка сразу для всех */
export function StreamBoard({ streamId }: { streamId: string }) {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => fetchStreamBoard(streamId), [streamId]);
  const [mode, setMode] = useState<'points' | 'attendance'>('points');
  const [target, setTarget] = useState<Target>(null);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-64" />;
  const board = data;
  const everyone = board.groups.flatMap((g) => g.students.map((s) => s.id));

  async function award(reason: Reason) {
    if (!target) return;
    const picked = target;
    setTarget(null);
    try {
      const res = await awardStream(streamId, picked.ids, reason.id);
      setData({
        ...board,
        groups: board.groups.map((g) => ({ ...g, students: g.students.map((s) => ({ ...s, ...res.summaries[s.id] })) })),
      });
      const sign = res.value > 0 ? `+${res.value}` : `−${Math.abs(res.value)}`;
      toast({ text: `${picked.label}: ${sign}, ${reason.name.toLowerCase()}`, tone: res.value > 0 ? 'ok' : 'neutral' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    }
  }

  const tab = (value: typeof mode, label: string) => (
    <button
      type="button"
      className={`btn ${mode === value ? 'btn-primary' : 'btn-secondary'}`}
      aria-pressed={mode === value}
      onClick={() => setMode(value)}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
            <ArrowLeftIcon size={16} /> Все группы
          </Link>
          <h1 className="mt-1 break-words text-2xl sm:text-3xl">{board.stream.name}</h1>
          <p className="mt-1 break-words text-ink-soft">{streamCaption(board.stream)}</p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Что отмечаем">
          {tab('points', 'Баллы')}
          {tab('attendance', 'Посещаемость')}
        </div>
      </div>

      {mode === 'attendance' ? (
        <StreamAttendance streamId={streamId} groups={board.groups} />
      ) : (
        <>
          <button
            className="btn btn-secondary"
            disabled={!everyone.length}
            onClick={() => setTarget({ label: 'Весь поток', ids: everyone })}
          >
            <UsersThreeIcon size={20} /> Всему потоку
          </button>
          {board.groups.map((g) => (
            <section key={g.id} className="space-y-3" aria-labelledby={`stream-group-${g.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={`stream-group-${g.id}`} className="text-lg">{g.name}</h2>
                {g.students.length > 0 && (
                  <button
                    className="btn btn-ghost"
                    aria-label={`Всей группе ${g.name}`}
                    onClick={() => setTarget({ label: g.name, ids: g.students.map((s) => s.id) })}
                  >
                    Всей группе
                  </button>
                )}
              </div>
              {g.students.length === 0 && <p className="text-ink-soft">В группе пока никого нет.</p>}
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {g.students.map((s) => (
                  <li key={s.id}>
                    <button
                      className={`card flex w-full items-center gap-3 p-3 text-left transition
                        hover:shadow-[var(--shadow-pop)] active:scale-[0.98]`}
                      onClick={() => setTarget({ label: s.name.split(' ')[0], ids: [s.id] })}
                    >
                      <HeroHead parts={s.hero.parts} className="size-11" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{s.name}</span>
                        <span className="block text-sm text-ink-soft">всего {s.totalEarned}</span>
                      </span>
                      {s.todayEarned > 0 && <span className="chip bg-plus-bg text-plus">+{s.todayEarned}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <ReasonPicker
        open={!!target}
        label={target?.label ?? ''}
        reasons={board.reasons}
        onPick={award}
        onClose={() => setTarget(null)}
        groupId={board.groups[0]?.id ?? ''}
      />
    </div>
  );
}
