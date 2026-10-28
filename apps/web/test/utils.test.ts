import { describe, expect, it } from 'vitest';
import { dateKey, formatDate, pluralize, points } from '../src/hooks';
import { formatName } from '../src/components/ImportStudentsModal';

describe('склонения', () => {
  it.each([
    [1, 'ученик'],
    [2, 'ученика'],
    [5, 'учеников'],
    [11, 'учеников'],
    [12, 'учеников'],
    [21, 'ученик'],
    [22, 'ученика'],
    [111, 'учеников'],
  ])('%i → %s', (n, word) => {
    expect(pluralize(n, 'ученик', 'ученика', 'учеников')).toBe(word);
  });
  it('баллы', () => {
    expect(points(1)).toBe('1 балл');
    expect(points(3)).toBe('3 балла');
    expect(points(10)).toBe('10 баллов');
  });
});

describe('даты', () => {
  it('ключ дня в локальном времени', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('дата урока с заглавной буквы', () => {
    const s = formatDate('2026-10-27');
    expect(s[0]).toBe(s[0].toUpperCase());
    expect(s).toContain('27');
    expect(s).toContain('октября');
  });
});

describe('имена из файла', () => {
  it('ФИО → Имя Фамилия', () => {
    expect(formatName('Гусев Роман Андреевич', true, true)).toBe('Роман Гусев');
    expect(formatName('Гусев Роман Андреевич', true, false)).toBe('Роман Гусев Андреевич');
    expect(formatName('Гусев Роман Андреевич', false, true)).toBe('Гусев Роман');
    expect(formatName('Гусев Роман Андреевич', false, false)).toBe('Гусев Роман Андреевич');
  });
  it('одно слово не трогаем', () => {
    expect(formatName('Яна', true, true)).toBe('Яна');
  });
});
