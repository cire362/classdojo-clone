import { CalendarBlankIcon, WarningIcon } from '@phosphor-icons/react';
import { HeroHead } from '../../hero';
import { pluralize } from '../../../lib/hooks';
import { Switch, Toggle } from '../../../ui';
import type { AttendanceFlow } from '../hooks/useAttendance';
import { dayLabel } from '../labels';
import { useTerms } from '../../auth';

/** Сверка списка с числом людей на фото */
export function AttendanceReview({ flow }: { flow: AttendanceFlow }) {
  const t = useTerms();
  const { data, preview, detection, present, setPresent, subtract, saving, saveStatus, date, isToday, multi, lessonLabel, changeSubtract, save, cancelReview } = flow;
  const total = data.students.length;
  const expected = detection ? Math.max(0, detection.count - (subtract ? 1 : 0)) : null;
  const mismatch = expected !== null && expected !== present.size;

  return (
    <div className="grid grid-cols-1 gap-6 pb-24 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:pb-0">
      {(!isToday || multi) && (
        <p className="flex items-center gap-2 font-semibold lg:col-span-2">
          <CalendarBlankIcon size={20} weight="bold" /> Отметка за {dayLabel(date)}
          {lessonLabel}
        </p>
      )}
      {detection && preview ? (
        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-surface-2">
            <img src={preview} alt="Фото группы" className="block w-full" />
            <svg className="absolute inset-0 size-full" viewBox={`0 0 ${detection.width} ${detection.height}`} preserveAspectRatio="none" aria-hidden>
              {detection.boxes.map((b, i) => (
                <rect
                  key={i}
                  className="anim-fade-in"
                  style={{ animationDelay: `${0.05 * i}s` }}
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  rx={8}
                  fill="rgb(238 106 60 / 0.14)"
                  stroke="#ee6a3c"
                  strokeWidth={Math.max(3, detection.width / 300)}
                />
              ))}
            </svg>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <p className="font-display text-2xl">
              На фото {detection.count} {pluralize(detection.count, 'человек', 'человека', 'человек')}
            </p>
            <p className="text-ink-soft">
              {subtract ? 'Без преподавателя ' : `Из них ${t.student.many.gen} `}
              {expected}, в группе {total}
            </p>
          </div>
          <Toggle checked={subtract} onChange={changeSubtract} label="Я тоже в кадре" hint="Вычитать преподавателя из числа людей на фото" />
        </section>
      ) : (
        <section className="space-y-2">
          <h2 className="text-2xl">Отметка без фото</h2>
          <p className="text-ink-soft">Снимите отметку с тех, кого нет на уроке.</p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg">
            Отмечено {present.size} из {total}
          </h3>
          <div className="flex gap-1">
            <button className="btn btn-ghost btn-sm" onClick={() => setPresent(new Set(data.students.map((s) => s.id)))}>
              Все
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setPresent(new Set())}>
              Никого
            </button>
          </div>
        </div>
        {mismatch && (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-accent/25 px-4 py-3 text-sm font-medium">
            <WarningIcon size={20} className="mt-px shrink-0" />
            На фото {expected} {pluralize(expected!, t.student.one.nom, t.student.one.gen, t.student.many.gen)},
            а отмечено {present.size}. Проверьте
            список, сохранить можно и так.
          </p>
        )}
        <ul className="card divide-y divide-line overflow-hidden">
          {data.students.map((s) => {
            const on = present.has(s.id);
            return (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 transition hover:bg-surface-2">
                  <HeroHead parts={s.hero.parts} className={`size-11 transition ${on ? '' : 'opacity-40 grayscale'}`} />
                  <span className={`flex-1 font-medium ${on ? '' : 'text-ink-soft line-through decoration-1'}`}>{s.name}</span>
                  <span className={`text-sm font-semibold ${on ? 'text-plus' : 'text-ink-soft'}`}>{on ? 'был' : 'не был'}</span>
                  <Switch
                    checked={on}
                    label={`${s.name} присутствует`}
                    onChange={(v) =>
                      setPresent((prev) => {
                        const next = new Set(prev);
                        if (v) next.add(s.id);
                        else next.delete(s.id);
                        return next;
                      })
                    }
                  />
                </label>
              </li>
            );
          })}
        </ul>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <div className="mx-auto flex max-w-7xl gap-2">
            <button className="btn btn-primary btn-lg flex-1 lg:flex-none" onClick={save} disabled={saving}>
              {saving ? (saveStatus?.state === 'offline' ? 'Ждём интернет…' : saveStatus?.state === 'retrying' ? 'Повторяем…' : 'Сохраняем…') : 'Сохранить'}
            </button>
            <button className="btn btn-secondary btn-lg" onClick={cancelReview}>
              Отмена
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
