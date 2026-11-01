import { describe, expect, it } from 'vitest';
import { pagesFor } from '../src/app/routes';

describe('код страниц по адресу', () => {
  it('главная: при известной роли — только её страница', () => {
    expect(pagesFor('/', 'TEACHER')).toEqual(['groups']);
    expect(pagesFor('/', 'STUDENT')).toEqual(['cabinet']);
    expect(pagesFor('/', 'PARENT')).toEqual(['parentHome']);
  });

  it('главная без роли — страницы всех ролей; остальные адреса от роли не зависят', () => {
    expect(pagesFor('/', null)).toEqual(['groups', 'cabinet', 'parentHome', 'admin']);
    expect(pagesFor('/g/abc/stats', 'TEACHER')).toEqual(['groupLayout', 'stats']);
    expect(pagesFor('/unknown')).toEqual([]);
    expect(pagesFor('/q')).toEqual(['codeLogin']);
    expect(pagesFor('/join')).toEqual(['codeLogin']);
    expect(pagesFor('/invite')).toEqual(['invite']);
    expect(pagesFor('/calendar')).toEqual(['studentCalendar']);
    expect(pagesFor('/g/abc/calendar')).toEqual(['groupLayout', 'groupCalendar']);
  });
});
