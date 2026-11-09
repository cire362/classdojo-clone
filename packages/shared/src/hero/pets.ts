/** Оригинальные компаньоны. Локальные тени, фактура и тёплый контур героя; холст питомца 64×64. */
export const PET_COMPANIONS = [
  { id: 'pet.fox', name: 'Искрик' },
  { id: 'pet.owl', name: 'Крылышко' },
  { id: 'pet.sprout', name: 'Листик' },
] as const;

export const PET_STAGES = [
  { level: 1, title: 'Малыш' },
  { level: 4, title: 'Напарник' },
  { level: 7, title: 'Хранитель' },
] as const;

export function petStageForLevel(level: number) {
  const safe = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const index = safe >= 7 ? 2 : safe >= 4 ? 1 : 0;
  return { stage: index + 1, title: PET_STAGES[index].title, nextLevel: PET_STAGES[index + 1]?.level ?? null };
}

const INK = '#303039';
const O = `stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;
function eyes(y: number) {
  return `<path d="M19 ${y}q4-7 9-1v5q-5 4-9-1Z M36 ${y - 1}q5-6 9 1v4q-5 4-9-1Z" fill="#fff9e9" stroke="${INK}" stroke-width="1.2"/>` +
    `<ellipse cx="25" cy="${y + 1}" rx="2.7" ry="3.6" fill="#775b42"/><ellipse cx="40" cy="${y + 1}" rx="2.7" ry="3.6" fill="#775b42"/>` +
    `<ellipse cx="25.5" cy="${y + 1}" rx="1.7" ry="2.8" fill="${INK}"/><ellipse cx="40.5" cy="${y + 1}" rx="1.7" ry="2.8" fill="${INK}"/>` +
    `<circle cx="24" cy="${y - .4}" r="1.1" fill="white"/><circle cx="39" cy="${y - .4}" r="1.1" fill="white"/>` +
    `<path d="M20 ${y - 6}l5-1M39 ${y - 7}l5 1" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
}

function fox(stage: number) {
  return (
    `<path d="M43 54 Q61 55 59 32 Q47 37 45 47 Z" fill="#ed8547" ${O}/>` +
    `<path d="M59 32 Q55 33 51 38 L57 42 Q60 37 59 32 Z" fill="#fff2d6" ${O}/>` +
    `<path d="M21 37 Q32 31 43 37 L46 54 Q45 60 39 60 L24 60 Q18 59 19 54 Z" fill="#ed8547" ${O}/>` +
    `<ellipse cx="32" cy="49" rx="7" ry="9" fill="#fff2d6"/>` +
    `<path d="M18 23 L13 7 Q24 7 28 18 M36 18 Q42 7 51 7 L47 26" fill="#ed8547" ${O}/>` +
    `<path d="M18 19 L17 12 L24 18 M40 18 L47 12 L46 21" fill="#b95733"/>` +
    `<path d="M14 25 Q16 15 32 16 Q48 15 50 25 L47 37 Q32 48 17 37 Z" fill="#ed8547" ${O}/>` +
    `<path d="M16 31 Q23 29 32 36 Q41 29 48 31 L45 38 Q32 45 19 38 Z" fill="#fff2d6"/>` + eyes(28) +
    `<path d="M29 35 L35 35 L32 38 Z" fill="${INK}"/><path d="M27 39 Q32 43 37 39" fill="none" ${O}/>` +
    (stage >= 2 ? `<path d="M20 42 Q32 47 44 42 L43 48 Q32 52 21 48 Z" fill="#ffd23f" ${O}/><path d="M40 47 L49 53 L40 56 Z" fill="#ffd23f" ${O}/>` : '') +
    (stage >= 3 ? `<path d="M26 16 L29 10 L33 15 L38 11 L38 17" fill="#fff2d6" ${O}/><path d="M31 46 L34 49 L31 52 L28 49 Z" fill="#ffffff" stroke="${INK}" stroke-width="1.5"/>` : '') +
    `<path d="M17 22l5 2-3 3M46 22l-5 2 3 3M45 48q7 3 10-6" fill="none" stroke="#bc663e" stroke-width="1.5"/>` +
    `<path d="M24 55 L24 60 M39 55 L39 60" fill="none" ${O}/>`
  );
}

function owl(stage: number) {
  return (
    `<path d="M23 57 L20 61 L28 61 M40 57 L36 61 L44 61" fill="#ffd23f" ${O}/>` +
    `<path d="M15 25 Q15 13 32 14 Q49 13 49 25 L47 46 Q45 58 32 59 Q19 58 17 46 Z" fill="#68c1d4" ${O}/>` +
    `<ellipse cx="32" cy="43" rx="11" ry="13" fill="#e4f5f3"/><path d="M24 42l3 3 3-3m4 0 3 3 3-3m-13 6 3 3 3-3m-1 6 3 2 3-2" fill="none" stroke="#98b9ab" stroke-width="1.3"/>` +
    `<path d="M17 32 Q9 36 13 49 Q21 46 23 39 M47 32 Q55 36 51 49 Q43 46 41 39" fill="#6975b7" ${O}/>` +
    `<path d="M17 23 Q24 17 32 23 Q40 17 47 23 L46 34 Q40 40 32 35 Q24 40 18 34 Z" fill="#e4f5f3"/>` + eyes(28) +
    `<path d="M29 35 L35 35 L32 40 Z" fill="#ffd23f" stroke="${INK}" stroke-width="1.5"/>` +
    (stage >= 2 ? `<path d="M19 18 L16 8 L29 15 M35 15 L48 8 L45 18" fill="#6975b7" ${O}/><path d="M28 45 L32 48 L36 45 M28 51 L32 54 L36 51" fill="none" stroke="#68c1d4" stroke-width="2.4" stroke-linecap="round"/>` : '') +
    (stage >= 3 ? `<path d="M26 16 L28 7 L32 12 L37 7 L38 17" fill="#ffd23f" ${O}/><path d="M10 35 Q7 40 9 46 M54 35 Q57 40 55 46" fill="none" ${O}/>` : '')
  );
}

function sprout(stage: number) {
  return (
    `<path d="M24 55 L21 61 L29 61 M39 55 L35 61 L43 61" fill="#467d54" ${O}/>` +
    `<path d="M32 23 L32 11" fill="none" ${O}/>` +
    `<path d="M32 19 Q16 20 16 6 Q30 5 32 19 Z M32 19 Q32 4 47 6 Q47 19 32 19 Z" fill="#71be7b" ${O}/>` +
    (stage >= 2 ? `<path d="M26 20 Q13 24 10 15 Q20 11 26 20 Z M38 20 Q51 24 54 15 Q44 11 38 20 Z" fill="#acd88b" ${O}/>` : '') +
    `<path d="M16 33 Q16 23 32 22 Q48 23 48 33 L46 48 Q44 58 32 59 Q20 58 18 48 Z" fill="#acd88b" ${O}/>` +
    `<path d="M21 10l9 7m12-7-9 7" stroke="#467d54" stroke-width="1.2"/><path d="M20 29q-3 9 0 16" fill="none" stroke="#d5edb1" stroke-width="2.6" stroke-linecap="round"/><path d="M17 39 L11 45 M47 39 L53 45" fill="none" ${O}/>` + eyes(34) +
    `<path d="M26 45 Q32 51 38 45" fill="none" ${O}/><circle cx="20" cy="43" r="3" fill="#ed8547" opacity="0.5"/><circle cx="44" cy="43" r="3" fill="#ed8547" opacity="0.5"/>` +
    (stage >= 3 ? `<path d="M26 9 Q23 2 29 2 Q32 3 32 6 Q35 0 39 4 Q42 9 36 11 Q36 16 32 15 Q28 16 28 12 Q22 13 23 8 Z" fill="#ffd23f" ${O}/><circle cx="32" cy="9" r="2.5" fill="#ed8547"/><path d="M25 54 L39 54" fill="none" stroke="#467d54" stroke-width="2.4" stroke-linecap="round"/>` : '')
  );
}

/** Непроверенные id никогда не попадают в SVG. Стадия выводится из уровня, не хранится в выборе деталей. */
export function renderPetFragment(id: string, level = 1): string {
  if (!PET_COMPANIONS.some((p) => p.id === id)) return '';
  const { stage } = petStageForLevel(level);
  const scale = [0.7, 0.85, 1][stage - 1];
  const body = id === 'pet.fox' ? fox(stage) : id === 'pet.owl' ? owl(stage) : sprout(stage);
  return `<g data-pet="${id}" data-pet-stage="${stage}" transform="translate(32 62) scale(${scale}) translate(-32 -62)">${body}</g>`;
}

export function renderPetSvg(id: string, level = 1): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${renderPetFragment(id, level)}</svg>`;
}
