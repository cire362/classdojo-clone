import { useId } from 'react';
import { useLoad } from '../../../lib/hooks';
import { useTerms } from '../../auth';
import { cap } from '@heroes/shared/terms';
import { addressText } from '../address';
import { fetchRecipients } from '../api';

/**
 * Кому отправить работу: куратору группы или преподавателю одной из дисциплин. Без дисциплин выбирать
 * не из чего, и поле просто называет того, кто получит работу. Пустое значение — куратору.
 */
export function RecipientField({ value, onChange }: { value: string; onChange: (subjectId: string) => void }) {
  const t = useTerms();
  const id = useId();
  const { data } = useLoad(fetchRecipients, []);
  if (!data) return <p className="h-11" aria-hidden />;
  const curator = addressText({ subject: null, teacher: data.curator }, t);
  if (!data.subjects.length) {
    return (
      <p className="text-sm">
        <span className="text-ink-soft">Кому:</span> {curator}
      </p>
    );
  }
  return (
    <div>
      <label className="label" htmlFor={id}>Кому</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{curator}</option>
        <optgroup label={cap(t.subject.many.nom)}>
          {data.subjects.map((s) => (
            <option key={s.id} value={s.id}>{addressText({ subject: s.name, teacher: s.teacher }, t)}</option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
