import { useState } from 'react';
import { cap } from '@heroes/shared/terms';
import { currentSubject, rememberSubject } from '../../../lib/subject';
import { useTerms } from '../../auth';
import type { GroupSubject } from '../../../lib/api';

/** Дисциплина урока: баллы и отметка уходят с ней. Показывается, если у группы есть дисциплины */
export function SubjectPicker({ groupId, subjects }: { groupId: string; subjects: GroupSubject[] }) {
  const t = useTerms();
  const [value, setValue] = useState(() => currentSubject(groupId, subjects) ?? '');
  if (!subjects.length) return null;
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="font-semibold">{cap(t.subject.one.nom)}</span>
      <select
        className="input w-auto py-2"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          rememberSubject(groupId, e.target.value || null);
        }}
      >
        <option value="">Без {t.subject.one.gen}</option>
        {subjects.map((s) => <option key={s.subject.id} value={s.subject.id}>{s.subject.name}</option>)}
      </select>
    </label>
  );
}
