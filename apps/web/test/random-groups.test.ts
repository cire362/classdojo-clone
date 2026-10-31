import { expect, it } from 'vitest';
import { randomLessonGroups } from '../src/features/lesson/random-groups';

it('каждый участник ровно один раз, вход не меняется, размеры отличаются не больше чем на одного', () => {
  for (let n = 2; n <= 200; n++) for (let size = 2; size <= 10; size++) {
    const ids = Array.from({ length: n }, (_, i) => `s${i}`);
    const before = [...ids];
    const groups = randomLessonGroups(ids, size, Math.random, size === 2 ? 'pairs' : 'groups');
    expect(groups.flat().sort()).toEqual([...ids].sort());
    expect(ids).toEqual(before);
    const lengths = groups.map((g) => g.length);
    expect(Math.min(...lengths)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(1);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(size === 2 ? 3 : size);
  }
});
it('нечётные пары дают тройку; повторы исключаются, одиночки не образуются', () => {
  expect(randomLessonGroups(['a', 'b', 'c'], 2, Math.random, 'pairs')).toHaveLength(1);
  expect(randomLessonGroups(['a', 'b', 'c', 'd', 'e'], 2, Math.random, 'pairs').map((g) => g.length).sort()).toEqual([2, 3]);
  expect(randomLessonGroups(['a', 'a'], 2)).toEqual([]);
  expect(randomLessonGroups([], 3)).toEqual([]);
  for (const size of [1, 11, 2.5, NaN]) expect(() => randomLessonGroups(['a', 'b'], size)).toThrow();
});
it('максимум два в режиме групп не превращается в тройку: нечётный состав отклоняется', () => {
  expect(() => randomLessonGroups(['a', 'b', 'c', 'd', 'e'], 2)).toThrow(/нечётного состава/);
  expect(randomLessonGroups(['a', 'b', 'c', 'd'], 2).map((g) => g.length)).toEqual([2, 2]);
});
it('перемешивание зависит от генератора, случайный порядок используется для каждого распределения', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  expect(randomLessonGroups(ids, 2, () => 0)).not.toEqual(randomLessonGroups(ids, 2, () => 0.999));
});
