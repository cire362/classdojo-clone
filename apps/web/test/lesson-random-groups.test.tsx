import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { LessonRandomGroups } from '../src/components/LessonRandomGroups';

const students = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, name: `Ученик ${i + 1}` }));
const panel = (patch: Partial<Parameters<typeof LessonRandomGroups>[0]> = {}) => <LessonRandomGroups students={students} presentIds={null} projector={false} target={null} {...patch} />;
const open = () => fireEvent.click(screen.getByRole('button', { name: /^Пары и группы/ }));
const result = () => screen.getByRole('list', { name: 'Случайное распределение' });

it('нечётный класс: пара и тройка, все участники ровно один раз, результат можно сбросить', () => {
  render(panel()); open(); fireEvent.click(screen.getByRole('button', { name: 'Сформировать' }));
  expect(within(result()).getAllByRole('heading')).toHaveLength(2);
  for (const student of students) expect(within(result()).getAllByText(student.name)).toHaveLength(1);
  expect(screen.getByText(/Одна тройка/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Перемешать заново' }));
  expect(within(result()).getAllByRole('heading')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить распределение' }));
  expect(screen.queryByRole('list', { name: 'Случайное распределение' })).not.toBeInTheDocument();
});

it('присутствующие выбираются по умолчанию, нулевая посещаемость не превращается во весь класс', () => {
  const view = render(panel({ presentIds: [] })); open();
  expect(screen.getByRole('button', { name: 'Сформировать' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Только присутствующие' }));
  fireEvent.click(screen.getByRole('button', { name: 'Сформировать' }));
  expect(within(result()).getAllByRole('heading')).toHaveLength(2);
  view.unmount();
  render(panel({ presentIds: ['s0', 's2'] })); open(); fireEvent.click(screen.getByRole('button', { name: 'Сформировать' }));
  expect(within(result()).getByText('Ученик 1')).toBeVisible();
  expect(within(result()).queryByText('Ученик 2')).not.toBeInTheDocument();
});

it('размер группы ограничен целым числом, изменение настроек сбрасывает результат', () => {
  render(panel()); open(); fireEvent.click(screen.getByRole('button', { name: 'По группам' }));
  const size = screen.getByRole('spinbutton');
  fireEvent.change(size, { target: { value: '2' } });
  expect(screen.getByRole('button', { name: 'Сформировать' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('максимум по двое');
  for (const value of ['1', '11', '2.5', '']) {
    fireEvent.change(size, { target: { value } }); expect(screen.getByRole('button', { name: 'Сформировать' })).toBeDisabled();
  }
  fireEvent.change(size, { target: { value: '3' } }); fireEvent.click(screen.getByRole('button', { name: 'Сформировать' }));
  expect(within(result()).getAllByRole('heading')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'По парам' }));
  expect(screen.queryByRole('list', { name: 'Случайное распределение' })).not.toBeInTheDocument();
});

it('изменение участников скрывает старое распределение, переименование обновляет подписи', () => {
  const view = render(panel()); open(); fireEvent.click(screen.getByRole('button', { name: 'Сформировать' }));
  view.rerender(panel({ students: students.map((s) => ({ ...s, name: s.name + ' новое' })) }));
  expect(within(result()).getByText('Ученик 1 новое')).toBeVisible();
  view.rerender(panel({ students: students.slice(0, 4) }));
  expect(screen.getByText(/Состав участников изменился/)).toBeVisible();
  expect(screen.queryByRole('list', { name: 'Случайное распределение' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Сформировать' })); expect(within(result()).getAllByRole('heading')).toHaveLength(2);
});

it('сворачивание и проектор сохраняют результат; после ухода он исчезает', () => {
  const target = document.createElement('div'); document.body.append(target);
  const view = render(panel()); open(); fireEvent.click(screen.getByRole('button', { name: 'Сформировать' }));
  const names = result().textContent;
  fireEvent.click(screen.getByRole('button', { name: 'Скрыть пары и группы' }));
  expect(screen.getByRole('button', { name: /^Пары и группы/ })).toHaveFocus();
  view.rerender(panel({ projector: true, target }));
  expect(result().textContent).toBe(names);
  fireEvent.click(screen.getByRole('button', { name: 'Скрыть пары и группы' }));
  open(); expect(result().textContent).toBe(names);
  view.rerender(panel()); expect(result().textContent).toBe(names); view.unmount(); target.remove();
  render(panel()); open(); expect(screen.queryByRole('list', { name: 'Случайное распределение' })).not.toBeInTheDocument();
});
