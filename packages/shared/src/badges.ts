/** Автоматические достижения. Расчёт выполняется на сервере по полной истории. adult — слова для колледжа и вуза */
export const BADGES = [
  {
    id: 'attendance.streak10', title: 'Всегда на месте', description: 'Посетить 10 отмеченных уроков подряд без пропусков.', target: 10,
    adult: { title: 'Всегда на месте', description: 'Посетить 10 отмеченных занятий подряд без пропусков.' },
  },
  {
    id: 'help.20', title: 'Надёжный друг', description: '20 раз помочь другим на уроке.', target: 20,
    adult: { title: 'Надёжный одногруппник', description: '20 раз помочь другим на занятиях.' },
  },
  {
    id: 'level.first5', title: 'Первый герой класса', target: 1,
    description: 'Одним из первых достичь 5-го уровня в группе после запуска значков.',
    adult: { title: 'Первый герой группы', description: 'Одним из первых достичь 5-го уровня в группе после запуска значков.' },
  },
] as const;
export type BadgeId = typeof BADGES[number]['id'];

export interface StudentBadge {
  id: BadgeId;
  title: string;
  description: string;
  progress: number;
  target: number;
  earnedOn: string | null;
  /** Пояснение условий первенства или ограничений старой истории */
  note: string | null;
  /** Группа, в которой заработано первенство (даже после перевода) */
  groupName: string | null;
}
