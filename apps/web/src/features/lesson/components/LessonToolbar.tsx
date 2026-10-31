import { CheckIcon, DiceFiveIcon, FlagBannerIcon, ProjectorScreenIcon, SelectionAllIcon, UsersThreeIcon } from '@phosphor-icons/react';

/** Кнопки над карточками: всей группе, выбор, случайный ученик, команды и проектор */
export function LessonToolbar({
  selectMode,
  searching,
  hasVisible,
  teamView,
  onSelectVisible,
  onCancelSelect,
  onAwardAll,
  onStartSelect,
  onRandom,
  onTeams,
  onSetupTeams,
  onProjector,
}: {
  selectMode: boolean;
  searching: boolean;
  hasVisible: boolean;
  teamView: boolean;
  onSelectVisible: () => void;
  onCancelSelect: () => void;
  onAwardAll: () => void;
  onStartSelect: () => void;
  onRandom: () => void;
  onTeams: () => void;
  onSetupTeams: () => void;
  onProjector: () => void;
}) {
  if (selectMode) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-secondary" onClick={onSelectVisible} disabled={!hasVisible}>
          <SelectionAllIcon size={20} /> {searching ? 'Выбрать найденных' : 'Выбрать всех'}
        </button>
        <button className="btn btn-ghost" onClick={onCancelSelect}>
          Отмена
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn btn-primary" onClick={onAwardAll}>
        <UsersThreeIcon size={20} weight="bold" /> Всей группе
      </button>
      <button className="btn btn-secondary" onClick={onStartSelect}>
        <CheckIcon size={20} /> Несколько
      </button>
      <button className="btn btn-secondary" onClick={onRandom}>
        <DiceFiveIcon size={20} /> Случайный
      </button>
      <button className={`btn ${teamView ? 'btn-secondary ring-2 ring-ink' : 'btn-secondary'}`} aria-pressed={teamView} onClick={onTeams}>
        <FlagBannerIcon size={20} /> Команды
      </button>
      {teamView && (
        <button className="btn btn-ghost" onClick={onSetupTeams}>
          Настроить команды
        </button>
      )}
      <button className="btn btn-secondary ml-auto hidden sm:inline-flex" onClick={onProjector}>
        <ProjectorScreenIcon size={20} /> Проектор
      </button>
    </div>
  );
}
