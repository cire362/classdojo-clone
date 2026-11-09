import { useState } from 'react';
import { GARDEN_LEVELS } from '@heroes/shared/world';
import { WorldMap } from './WorldMap';

/** Вкладка группы: что такое Сад маяков и какие в нём места. Настраивать нечего — сад открыт ученикам всегда */
export function TeacherWorld() {
  const [selected, setSelected] = useState(0);
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl">Мир ученика · Сад маяков</h2>
        <p className="max-w-2xl text-ink-soft">
          Шесть маршрутных головоломок: планировать, проверять и пробовать снова. Сад открыт ученикам в любой момент,
          без покупок, соревнования и штрафов за ошибку. Учебные баллы и награды он не меняет. Если в группе выключить
          героев, сад тоже закроется.
        </p>
      </header>
      <WorldMap completed={[]} selected={selected} onSelect={setSelected} preview />
      <p className="max-w-2xl text-ink-soft">{GARDEN_LEVELS[selected].story}</p>
    </div>
  );
}
