import { useEffect, useState, type FormEvent } from 'react';
import { MoonIcon } from '@phosphor-icons/react';
import { useLoad } from '../../../lib/hooks';
import { Skeleton, Switch } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { fetchQuietHours, saveQuietHours } from '../api';

const DEFAULT_HOURS = { from: '21:00', to: '08:00' };

/** Тихие часы: значка новых сообщений нет, а родитель видит, когда ждать ответа */
export function QuietHoursCard() {
  const toast = useToast();
  const { data, error } = useLoad(fetchQuietHours, []);
  const [on, setOn] = useState(false);
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setOn(!!data.hours);
    if (data.hours) setHours(data.hours);
  }, [data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await saveQuietHours(on ? hours : null);
      toast({ text: on ? 'Тихие часы сохранены' : 'Тихие часы выключены', tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5" aria-labelledby="quiet-title" noValidate>
      <h2 id="quiet-title" className="flex items-center gap-2 text-lg">
        <MoonIcon size={22} aria-hidden /> Тихие часы
      </h2>
      <p className="text-sm text-ink-soft">
        В это время на значке сообщений не появляются новые, а родители видят, когда вы ответите. Сами сообщения никуда не деваются:
        прочитать их можно в любой момент. Время указывается по часовому поясу школы.
      </p>
      {error && <p role="alert" className="text-sm text-minus">{error}</p>}
      {!data && !error && <Skeleton className="h-16" />}
      {data && (
        <>
          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={on} onChange={setOn} label="Включить тихие часы" />
            <span className="text-sm">Включить тихие часы</span>
          </label>
          {on && (
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="label" htmlFor="quiet-from">С</label>
                <input
                  id="quiet-from"
                  type="time"
                  className="input w-32"
                  value={hours.from}
                  onChange={(e) => setHours({ ...hours, from: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="quiet-to">До</label>
                <input
                  id="quiet-to"
                  type="time"
                  className="input w-32"
                  value={hours.to}
                  onChange={(e) => setHours({ ...hours, to: e.target.value })}
                />
              </div>
            </div>
          )}
          <button className="btn btn-primary" disabled={busy || (on && (!hours.from || !hours.to || hours.from === hours.to))}>
            Сохранить
          </button>
        </>
      )}
    </form>
  );
}
