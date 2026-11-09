import { iconKey, type IconKey } from '@heroes/shared/icons';
import { Glyph, ICON_LABELS } from './Glyph';

/** Выбор значка из набора: кнопки с рисованными иконками, выбранная отмечена */
export function IconPicker({ options, value, onChange, legend = 'Значок' }: {
  options: IconKey[];
  value: string;
  onChange: (key: IconKey) => void;
  legend?: string;
}) {
  const current = iconKey(value);
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={current === key}
            aria-label={`Значок: ${ICON_LABELS[key]}`}
            title={ICON_LABELS[key]}
            className={`flex size-10 items-center justify-center rounded-xl transition ${
              current === key ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink hover:bg-line'
            }`}
            onClick={() => onChange(key)}
          >
            <Glyph name={key} size={22} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}
