/** Fisher–Yates, затем равномерное распределение. Нечётная пара становится тройкой, одиночек нет. */
export function randomLessonGroups(ids: readonly string[], size: number, random: () => number = Math.random, mode: 'pairs' | 'groups' = 'groups'): string[][] {
  if (!Number.isInteger(size) || size < 2 || size > 10) throw new Error('Размер группы — от 2 до 10');
  const shuffled = [...new Set(ids)];
  if (shuffled.length < 2) return [];
  if (mode === 'groups' && size === 2 && shuffled.length % 2) throw new Error('Для нечётного состава выберите пары с тройкой или размер группы от 3');
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const count = mode === 'pairs' ? Math.floor(shuffled.length / 2) : Math.ceil(shuffled.length / size);
  const groups = Array.from({ length: count }, () => [] as string[]);
  shuffled.forEach((id, i) => groups[i % count].push(id));
  return groups;
}
