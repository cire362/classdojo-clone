import { useId } from 'react';
import { useLoad } from '../../../lib/hooks';
import { useTerms } from '../../auth';
import { addressText } from '../address';
import { fetchRecipients } from '../api';

/** Значение поля: преподаватель и дисциплина через двоеточие; пусто — куратору */
export const recipientValue = (teacherId: string, subjectId: string | null) => `${teacherId}:${subjectId ?? ''}`;

/**
 * Кому отправить работу: любой преподаватель группы — куратор, преподаватель дисциплины или коллега без дисциплины.
 * Если преподаватель в группе один, выбирать не из чего, и поле просто называет его.
 */
export function RecipientField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTerms();
  const id = useId();
  const { data } = useLoad(fetchRecipients, []);
  if (!data) return <p className="h-11" aria-hidden />;
  if (data.length === 1) {
    return (
      <p className="text-sm">
        <span className="text-ink-soft">Кому:</span> {addressText(data[0], t)}
      </p>
    );
  }
  return (
    <div>
      <label className="label" htmlFor={id}>Кому</label>
      <select
        id={id}
        className="input"
        value={value || recipientValue(data[0].teacherId, null)}
        onChange={(e) => onChange(e.target.value)}
      >
        {data.map((r) => (
          <option key={recipientValue(r.teacherId, r.subjectId)} value={recipientValue(r.teacherId, r.subjectId)}>
            {addressText(r, t)}
          </option>
        ))}
      </select>
    </div>
  );
}
