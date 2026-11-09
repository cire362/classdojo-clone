import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GARDEN_LEVELS, type Direction } from '@heroes/shared/world';
import { ErrorBox, Skeleton } from '../../../ui';
import { useLoad } from '../../../lib/hooks';
import { fetchWorld, solveWorld } from '../api';
import { WorldMap } from './WorldMap';
import { GardenBoard } from './GardenBoard';

/** Сад маяков ученика: открыт в любой момент, прогресс хранится на сервере */
export function StudentWorld() {
  const { data, error, reload, setData } = useLoad(fetchWorld, []);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-80 w-full" />;
  // По умолчанию открыто первое невосстановленное место
  const next = GARDEN_LEVELS.findIndex((l) => !data.completed.includes(l.id));
  const current = selected ?? (next < 0 ? 0 : next);

  async function solve(moves: Direction[]) {
    setBusy(true);
    setNotice('');
    try {
      const level = GARDEN_LEVELS[current];
      setData(await solveWorld(level.id, moves));
      setSelected(null);
      setNotice(`Место «${level.title}» восстановлено!`);
      return true;
    } catch (e) {
      setNotice((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/" className="text-sm underline">В кабинет</Link>
      <header className="space-y-2">
        <h1 className="text-3xl">Сад маяков</h1>
        <p className="max-w-2xl text-ink-soft">
          Помоги своему герою вернуть свет в сад. Здесь можно пробовать и ошибаться: школьные баллы и награды не меняются.
        </p>
      </header>
      <WorldMap completed={data.completed} selected={current} onSelect={setSelected} />
      {data.completed.length === GARDEN_LEVELS.length && (
        <p className="rounded-2xl bg-accent/20 p-4 font-semibold">
          Весь сад сияет! Все шесть мест восстановлены. Можно возвращаться и искать новые маршруты.
        </p>
      )}
      {data.reason && <p className="rounded-2xl border border-line p-4">{data.reason}</p>}
      {notice && <p role="status">{notice}</p>}
      {data.available && (
        <GardenBoard
          key={current}
          level={GARDEN_LEVELS[current]}
          hero={data.hero}
          disabled={busy}
          onSolve={solve}
        />
      )}
    </div>
  );
}
