import { expect, it } from 'vitest';
import { matchesStudent } from '../src/lib/student-search';

it('поиск ученика по фамилии, логину и нескольким словам; е/ё равнозначны', () => {
  const student = { name: 'Артём Ковалёв', login: 'artem.k' };
  for (const query of ['КОВАЛЕВ', '  ковалеВ   артем ', 'artem.k', '', '  ']) expect(matchesStudent(student, query)).toBe(true);
  expect(matchesStudent(student, 'Артем Смирнов')).toBe(false);
});
