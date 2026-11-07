import { useState } from 'react';
import { CalendarBlankIcon, CaretLeftIcon, CaretRightIcon, PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react';
import type { ClassEvent } from '../../../lib/api';
import { dateKey, formatDate, useLoad } from '../../../lib/hooks';
import { EmptyState, ErrorBox, Skeleton } from '../../../ui';
import { fetchEvents } from '../api';
import { EventModal } from './EventModal';
import { useTerms } from '../../auth';

const firstDay = (month: string, shift = 0) => new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 + shift, 1);

const shiftMonth = (month: string, by: number) => dateKey(firstDay(month, by)).slice(0, 7);

function monthTitle(month: string) {
  const title = firstDay(month).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  return title.charAt(0).toUpperCase() + title.slice(1).replace(' г.', '');
}

/** События месяца. С editable преподаватель добавляет и меняет их */
export function Calendar({ path, editable = false }: { path: string; editable?: boolean }) {
  const t = useTerms();
  const today = dateKey();
  const [month, setMonth] = useState(today.slice(0, 7));
  const { data, error, reload } = useLoad(() => fetchEvents(path, month), [path, month]);
  const [editing, setEditing] = useState<ClassEvent | 'new' | null>(null);
  const days = [...new Set(data?.map((e) => e.date))];

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="icon-btn" aria-label="Предыдущий месяц" onClick={() => setMonth(shiftMonth(month, -1))}>
          <CaretLeftIcon size={20} />
        </button>
        <h2 aria-live="polite" className="min-w-40 text-center text-lg">{monthTitle(month)}</h2>
        <button className="icon-btn" aria-label="Следующий месяц" onClick={() => setMonth(shiftMonth(month, 1))}>
          <CaretRightIcon size={20} />
        </button>
        {month !== today.slice(0, 7) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(today.slice(0, 7))}>Сегодня</button>
        )}
        {editable && (
          <button className="btn btn-primary btn-sm ml-auto" onClick={() => setEditing('new')}>
            <PlusIcon size={18} aria-hidden /> Событие
          </button>
        )}
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-40" />}
      {data?.length === 0 && (
        <EmptyState icon={<CalendarBlankIcon size={28} />} title="В этом месяце событий нет">
          {editable
            ? `Добавьте контрольные, экскурсии и собрания: их увидят ${t.student.many.nom} и родители.`
            : 'Когда преподаватель добавит событие, оно появится здесь.'}
        </EmptyState>
      )}
      {days.map((day) => (
        <section key={day} aria-label={formatDate(day)} className={day < today ? 'opacity-70' : ''}>
          <h3 className="mb-2 flex items-center gap-2 font-sans text-sm font-semibold text-ink-soft">
            {formatDate(day)}
            {day === today && <span className="chip bg-accent text-xs text-on-accent">Сегодня</span>}
          </h3>
          <ul className="space-y-2">
            {data!.filter((e) => e.date === day).map((event) => (
              <li key={event.id} className="card flex items-start gap-3 p-4">
                <span className="w-12 shrink-0 font-semibold tabular-nums">{event.time ?? 'День'}</span>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold">{event.title}</p>
                  {event.description && <p className="mt-1 whitespace-pre-line break-words text-sm text-ink-soft">{event.description}</p>}
                </div>
                {editable && (
                  <button className="icon-btn -mr-2 -mt-2" aria-label={`Изменить: ${event.title}`} onClick={() => setEditing(event)}>
                    <PencilSimpleIcon size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {editing && (
        <EventModal
          key={editing === 'new' ? 'new' : editing.id}
          path={path}
          event={editing === 'new' ? null : editing}
          date={month === today.slice(0, 7) ? today : `${month}-01`}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}
