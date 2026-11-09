/** «Сад маяков»: оригинальные маршрутные головоломки. Никаких учебных баллов и покупок. */
export type Direction = 'up' | 'right' | 'down' | 'left';
export type GardenLevel = { id: string; title: string; story: string; rows: string[]; maxSteps: number };
export const GARDEN_LEVELS: GardenLevel[] = [
  { id: 'landing', title: 'Тихий причал', maxSteps: 8,
    story: 'Первый огонёк поможет путникам найти сад. Пройди через фонарь к маяку.',
    rows: ['S.*..', '.##..', '...#.', '.#...', '....G'] },
  { id: 'stream', title: 'Ручей встреч', maxSteps: 12,
    story: 'У ручья погасли два фонаря. Найди дорогу, которая соединит оба берега.',
    rows: ['S#...', '.#.*.', '.*.#.', '.###.', '....G'] },
  { id: 'wind', title: 'Сад ветра', maxSteps: 12,
    story: 'Ветер спрятал свет за камнями. Сначала осмотрись, потом строй маршрут.',
    rows: ['S.*..', '###..', '.*...', '..###', '.*..G'] },
  { id: 'arch', title: 'Арка света', maxSteps: 16,
    story: 'Три огонька питают арку. Иногда короткий путь начинается с обхода.',
    rows: ['S...*', '.###.', '.*...', '.###.', '*...G'] },
  { id: 'observatory', title: 'Звёздная площадка', maxSteps: 24,
    story: 'Площадка оживёт, когда свет придёт во все её уголки. Можно возвращаться по своим следам.',
    rows: ['S.*#*', '.#.#.', '.....', '.#.#.', '*#..G'] },
  { id: 'beacon', title: 'Большой маяк', maxSteps: 20,
    story: 'Остался последний маршрут. Соедини четыре фонаря — и весь сад наполнится светом.',
    rows: ['S.*.*', '.###.', '*...*', '.###.', '....G'] },
];
export const DIRECTIONS: Record<Direction, [number, number]> = {
  up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0],
};

export function walkGarden(level: GardenLevel, moves: Direction[]) {
  const cells = level.rows.join('');
  const width = level.rows[0].length;
  let position = cells.indexOf('S');
  const lit = new Set<number>();
  const path = [position];
  for (const move of moves) {
    const delta = DIRECTIONS[move];
    if (!delta) return { valid: false, won: false, position, lit: [...lit], path };
    const x = position % width + delta[0];
    const y = Math.floor(position / width) + delta[1];
    if (x < 0 || y < 0 || x >= width || y >= level.rows.length || level.rows[y][x] === '#') {
      return { valid: false, won: false, position, lit: [...lit], path };
    }
    position = y * width + x;
    path.push(position);
    if (cells[position] === '*') lit.add(position);
  }
  const valid = moves.length <= level.maxSteps;
  const won = valid && cells[position] === 'G' && lit.size === [...cells].filter((c) => c === '*').length;
  return { valid, won, position, lit: [...lit], path };
}
