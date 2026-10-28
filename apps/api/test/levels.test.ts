import { describe, expect, it } from 'vitest';
import { LEVELS, levelForPoints } from '@heroes/shared';

describe('расчёт уровня', () => {
  it('0 баллов — первый уровень', () => {
    const l = levelForPoints(0);
    expect(l.level).toBe(1);
    expect(l.title).toBe(LEVELS[0].title);
    expect(l.nextThreshold).toBe(LEVELS[1].threshold);
    expect(l.progress).toBe(0);
  });

  it('ровно на пороге — новый уровень', () => {
    expect(levelForPoints(LEVELS[1].threshold).level).toBe(2);
    expect(levelForPoints(LEVELS[1].threshold - 1).level).toBe(1);
    expect(levelForPoints(LEVELS[4].threshold).level).toBe(5);
  });

  it('прогресс и сколько осталось', () => {
    const a = LEVELS[1].threshold;
    const b = LEVELS[2].threshold;
    const mid = a + Math.floor((b - a) / 2);
    const l = levelForPoints(mid);
    expect(l.level).toBe(2);
    expect(l.pointsToNext).toBe(b - mid);
    expect(l.progress).toBeCloseTo((mid - a) / (b - a));
  });

  it('максимальный уровень', () => {
    const l = levelForPoints(1_000_000);
    expect(l.level).toBe(LEVELS.length);
    expect(l.nextThreshold).toBeNull();
    expect(l.progress).toBe(1);
    expect(l.pointsToNext).toBe(0);
  });

  it('отрицательные и дробные значения не ломают расчёт', () => {
    expect(levelForPoints(-5).level).toBe(1);
    expect(levelForPoints(9.9).level).toBe(levelForPoints(9).level);
  });

  it('пороги в конфиге строго возрастают и начинаются с нуля', () => {
    expect(LEVELS[0].threshold).toBe(0);
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].threshold).toBeGreaterThan(LEVELS[i - 1].threshold);
  });
});
