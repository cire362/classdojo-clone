/**
 * Словарь интерфейса по типу учебного заведения: школа, колледж или техникум (СПО), вуз.
 * Общий для клиента и сервера: так тексты интерфейса, сообщения API и отчёты говорят одними словами.
 * Отдельный вход `@heroes/shared/terms`, чтобы ядро приложения не тянуло каталог героя.
 */
export type InstitutionKind = 'SCHOOL' | 'COLLEGE' | 'UNIVERSITY';

export const INSTITUTION_KINDS: InstitutionKind[] = ['SCHOOL', 'COLLEGE', 'UNIVERSITY'];

/** Падежи: именительный, родительный, дательный, винительный, творительный, предложный */
export interface Cases {
  nom: string;
  gen: string;
  dat: string;
  acc: string;
  ins: string;
  prep: string;
}

export interface Noun {
  one: Cases;
  many: Cases;
}

export interface Terms {
  kind: InstitutionKind;
  /** Тип в списке выбора: «Школа», «Колледж или техникум», «Вуз» */
  kindName: string;
  /** Учреждение: школа, колледж, вуз */
  org: Noun;
  /** «Ваша школа», «ваш колледж»: род меняет прилагательное */
  orgFeminine: boolean;
  /** Учебная группа: класс в школе, группа в СПО и вузе */
  group: Noun;
  groupFeminine: boolean;
  /** Ученик или студент */
  student: Noun;
  /** Должности администрации: права одинаковы, названия зависят от типа */
  roles: { DIRECTOR: string; DEPUTY: string; STAFF: string };
}

const noun = (one: string[], many: string[]): Noun => {
  const cases = ([nom, gen, dat, acc, ins, prep]: string[]): Cases => ({ nom, gen, dat, acc, ins, prep });
  return { one: cases(one), many: cases(many) };
};

const CLASS = noun(
  ['класс', 'класса', 'классу', 'класс', 'классом', 'классе'],
  ['классы', 'классов', 'классам', 'классы', 'классами', 'классах'],
);
const GROUP = noun(
  ['группа', 'группы', 'группе', 'группу', 'группой', 'группе'],
  ['группы', 'групп', 'группам', 'группы', 'группами', 'группах'],
);
const PUPIL = noun(
  ['ученик', 'ученика', 'ученику', 'ученика', 'учеником', 'ученике'],
  ['ученики', 'учеников', 'ученикам', 'учеников', 'учениками', 'учениках'],
);
const STUDENT = noun(
  ['студент', 'студента', 'студенту', 'студента', 'студентом', 'студенте'],
  ['студенты', 'студентов', 'студентам', 'студентов', 'студентами', 'студентах'],
);

export const TERMS: Record<InstitutionKind, Terms> = {
  SCHOOL: {
    kind: 'SCHOOL',
    kindName: 'Школа',
    org: noun(['школа', 'школы', 'школе', 'школу', 'школой', 'школе'], ['школы', 'школ', 'школам', 'школы', 'школами', 'школах']),
    orgFeminine: true,
    group: CLASS,
    groupFeminine: false,
    student: PUPIL,
    roles: { DIRECTOR: 'Директор', DEPUTY: 'Завуч', STAFF: 'Сотрудник' },
  },
  COLLEGE: {
    kind: 'COLLEGE',
    kindName: 'Колледж или техникум',
    org: noun(
      ['колледж', 'колледжа', 'колледжу', 'колледж', 'колледжем', 'колледже'],
      ['колледжи', 'колледжей', 'колледжам', 'колледжи', 'колледжами', 'колледжах'],
    ),
    orgFeminine: false,
    group: GROUP,
    groupFeminine: true,
    student: STUDENT,
    roles: { DIRECTOR: 'Директор', DEPUTY: 'Заместитель директора', STAFF: 'Сотрудник' },
  },
  UNIVERSITY: {
    kind: 'UNIVERSITY',
    kindName: 'Вуз',
    org: noun(['вуз', 'вуза', 'вузу', 'вуз', 'вузом', 'вузе'], ['вузы', 'вузов', 'вузам', 'вузы', 'вузами', 'вузах']),
    orgFeminine: false,
    group: GROUP,
    groupFeminine: true,
    student: STUDENT,
    roles: { DIRECTOR: 'Ректор', DEPUTY: 'Проректор', STAFF: 'Сотрудник' },
  },
};

/** Словарь по типу; неизвестный тип или его отсутствие (вход без учреждения) — школа */
export const termsFor = (kind?: InstitutionKind | null): Terms => TERMS[kind ?? 'SCHOOL'] ?? TERMS.SCHOOL;

/** С заглавной буквы: «Школа», «Колледж» */
export const cap = (word: string) => word.charAt(0).toLocaleUpperCase('ru') + word.slice(1);

/** «ваша школа» / «ваш колледж», «ваш класс» / «ваша группа» */
export const your = (feminine: boolean, word: string) => `${feminine ? 'ваша' : 'ваш'} ${word}`;
