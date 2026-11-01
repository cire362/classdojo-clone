import { localDateTime } from '../../../lib/hooks';

/** Отправка позже: флажок и время. Пустая строка значит «отправить сразу» */
export function SendLater({ on, at, onToggle, onTime }: {
  on: boolean;
  at: string;
  onToggle: (on: boolean) => void;
  onTime: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} />
        Отправить позже
      </label>
      {on && (
        <input
          type="datetime-local"
          className="input w-auto"
          aria-label="Дата и время отправки"
          min={localDateTime()}
          value={at}
          onChange={(e) => onTime(e.target.value)}
        />
      )}
    </div>
  );
}
