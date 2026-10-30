import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShuffleIcon, UsersThreeIcon, XIcon } from '@phosphor-icons/react';
import { randomLessonGroups } from '../lib/random-groups';
import { pluralize } from '../hooks';
import { Switch } from '../ui';

interface Participant { id: string; name: string }
export function LessonRandomGroups({ students, presentIds, projector, target }: {
  students: Participant[];
  presentIds: readonly string[] | null;
  projector: boolean;
  target: HTMLElement | null;
}) {
  const [open, setOpen] = useState(false);
  const [projectorHidden, setProjectorHidden] = useState(false);
  const [mode, setMode] = useState<'pairs' | 'groups'>('pairs');
  const [size, setSize] = useState('4');
  const [onlyPresent, setOnlyPresent] = useState(presentIds !== null);
  const [result, setResult] = useState<{ signature: string; groups: string[][] } | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const focusToggle = useRef(false);
  const id = useId();
  const present = presentIds === null ? null : new Set(presentIds);
  const participants = students.filter((s) => !onlyPresent || !present || present.has(s.id));
  const signature = participants.map((s) => s.id).sort().join('|');
  const fresh = !!result && signature === result.signature;
  const expanded = open || (projector && fresh && !projectorHidden);
  const groupSize = mode === 'pairs' ? 2 : /^\d{1,2}$/.test(size) ? Number(size) : 0;
  const oddMaxTwo = mode === 'groups' && groupSize === 2 && participants.length >= 3 && participants.length % 2 === 1;
  const valid = groupSize >= 2 && groupSize <= 10 && !oddMaxTwo;
  const names = new Map(students.map((s) => [s.id, s.name]));
  useEffect(() => { if (!expanded && focusToggle.current) { toggle.current?.focus(); focusToggle.current = false; } }, [expanded]);

  function chooseMode(next: typeof mode) {
    if (next !== mode) { setMode(next); setResult(null); }
  }
  function generate() {
    if (valid && participants.length >= 2) setResult({ signature, groups: randomLessonGroups(participants.map((s) => s.id), groupSize, Math.random, mode) });
  }
  const panel = <section aria-label="Пары и группы урока" className={projector ? 'mb-6' : expanded ? 'w-full' : ''}>
    {!expanded ? <button ref={toggle} className="btn btn-secondary btn-sm" aria-expanded={false} onClick={() => { setOpen(true); setProjectorHidden(false); }}><UsersThreeIcon size={20} aria-hidden /> Пары и группы{fresh && <span>· {result.groups.length}</span>}</button> : <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className={`flex items-center gap-2 font-sans font-semibold ${projector ? 'text-2xl' : 'text-base'}`}><UsersThreeIcon size={22} aria-hidden /> Пары и группы на урок</h2>
        <button className="icon-btn -mr-2 -mt-2" aria-label="Скрыть пары и группы" onClick={() => { focusToggle.current = true; setOpen(false); if (projector) setProjectorHidden(true); }}><XIcon size={20} aria-hidden /></button>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <fieldset>
          <legend className="label">Распределить</legend>
          <div className="flex gap-1 rounded-full bg-surface-2 p-1">
            <button className={`tab ${mode === 'pairs' ? 'active' : ''}`} aria-pressed={mode === 'pairs'} onClick={() => chooseMode('pairs')}>По парам</button>
            <button className={`tab ${mode === 'groups' ? 'active' : ''}`} aria-pressed={mode === 'groups'} onClick={() => chooseMode('groups')}>По группам</button>
          </div>
        </fieldset>
        {mode === 'groups' && <div>
          <label className="label" htmlFor={`${id}-size`}>Не больше человек в группе</label>
          <input id={`${id}-size`} type="number" inputMode="numeric" min={2} max={10} step={1} className="input w-24 tabular-nums" value={size} aria-describedby={`${id}-range`} onChange={(e) => { setSize(e.target.value); setResult(null); }} />
          <p id={`${id}-range`} className="mt-1 text-xs text-ink-soft">От 2 до 10</p>
        </div>}
        <button className="btn btn-primary" disabled={!valid || participants.length < 2} onClick={generate}><ShuffleIcon size={20} aria-hidden /> {fresh ? 'Перемешать заново' : 'Сформировать'}</button>
        {result && <button className="btn btn-ghost" onClick={() => setResult(null)}>Сбросить распределение</button>}
      </div>
      <div className="mt-4 space-y-2">
        {present !== null && <label className="inline-flex cursor-pointer items-center gap-2"><Switch checked={onlyPresent} label="Только присутствующие" onChange={(checked) => { setOnlyPresent(checked); setResult(null); }} /><span className="text-sm">Только присутствующие</span></label>}
        <p className="text-sm text-ink-soft">Участников: {participants.length}. {present === null ? 'Посещаемость за сегодня не отмечена — используется весь класс.' : onlyPresent ? 'По последней отметке посещаемости за сегодня.' : 'Все ученики группы.'}</p>
      </div>
      {participants.length < 2 ? <p role="status" className="mt-4 rounded-xl bg-surface-2 p-4 text-sm">Для распределения нужны хотя бы два ученика.{present && onlyPresent ? ' Можно включить всю группу.' : ''}</p> : !valid ? <p role="alert" className="mt-4 text-sm text-minus">{oddMaxTwo ? 'При нечётном составе максимум по двое оставит одиночку. Выберите «По парам» с одной тройкой или размер группы от 3.' : 'Укажите целое число от 2 до 10.'}</p> : result && !fresh ? <p role="status" className="mt-4 rounded-xl bg-surface-2 p-4 text-sm">Состав участников изменился. Сформируйте распределение заново.</p> : fresh ? <>
        <p role="status" className="mt-4 text-sm text-ink-soft">Сформировано: {result.groups.length} {pluralize(result.groups.length, 'группа', 'группы', 'групп')}.{mode === 'pairs' && participants.length % 2 ? ' Одна тройка, чтобы никто не остался один.' : ' Размеры отличаются не больше чем на одного ученика.'}</p>
        <ol className={`mt-4 grid gap-3 ${projector ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3'}`} aria-label="Случайное распределение">
          {result.groups.map((group, index) => <li key={index} className="min-w-0 rounded-xl bg-surface-2 p-4">
            <h3 className={`font-sans font-semibold ${projector ? 'text-2xl' : 'text-base'}`}>{mode === 'pairs' ? group.length === 3 ? 'Тройка' : 'Пара' : 'Группа'} {index + 1}</h3>
            <ul className={`mt-2 space-y-1 ${projector ? 'text-2xl leading-snug' : 'text-sm'}`}>{group.map((studentId) => <li key={studentId} className="break-words">{names.get(studentId)}</li>)}</ul>
          </li>)}
        </ol>
      </> : null}
      <p className="mt-4 text-sm text-ink-soft">Только для текущего урока. Постоянные команды и баллы не меняются; после ухода со страницы распределение исчезнет.</p>
    </div>}
  </section>;
  return projector ? target ? createPortal(panel, target) : null : panel;
}
