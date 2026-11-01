import { useState, type FormEvent } from 'react';
import type { ClassEvent } from '../../../lib/api';
import { Modal } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { createEvent, deleteEvent, updateEvent } from '../api';

const REMINDERS: [string, string][] = [
  ['', 'Без напоминания'],
  ['0', 'В день события'],
  ['1', 'За день'],
  ['2', 'За два дня'],
  ['7', 'За неделю'],
];

/** Новое событие на дату date или изменение существующего */
export function EventModal({ path, event, date, onClose, onSaved }: {
  path: string;
  event: ClassEvent | null;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: event?.title ?? '',
    description: event?.description ?? '',
    date: event?.date ?? date,
    time: event?.time ?? '',
    remind: event?.remindDays === null || !event ? '' : String(event.remindDays),
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  async function run(request: () => Promise<unknown>) {
    setBusy(true);
    try {
      await request();
      onSaved();
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
      setBusy(false);
    }
  }
  function save(e: FormEvent) {
    e.preventDefault();
    const data = {
      title: form.title.trim(),
      description: form.description.trim(),
      date: form.date,
      time: form.time || null,
      remindDays: form.remind === '' ? null : Number(form.remind),
    };
    void run(() => (event ? updateEvent(path, event.id, data) : createEvent(path, data)));
  }

  return (
    <Modal open title={event ? 'Событие' : 'Новое событие'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="event-title">Название</label>
          <input
            id="event-title"
            className="input"
            maxLength={120}
            autoFocus
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="label" htmlFor="event-date">Дата</label>
            <input id="event-date" type="date" className="input w-44" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="event-time">Время, если нужно</label>
            <input id="event-time" type="time" className="input w-36" value={form.time} onChange={(e) => set({ time: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="event-note">Описание</label>
          <textarea
            id="event-note"
            className="input min-h-20 resize-y"
            maxLength={500}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="event-remind">Напоминание</label>
          <select id="event-remind" className="input" value={form.remind} onChange={(e) => set({ remind: e.target.value })}>
            {REMINDERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <p className="mt-1 text-sm text-ink-soft">Появится в ленте класса в 8:00, ученики и родители увидят значок.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy || !form.title.trim() || !form.date}>Сохранить</button>
          {event && (
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => run(() => deleteEvent(path, event.id))}>
              Удалить
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
