import { act, fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { MaterialViewer, MaterialsLibrary } from '../src/features/materials';
import type { MaterialItem } from '../src/lib/api';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => {
  api.mockReset();
});

const item = (id: string, extra: Partial<MaterialItem> = {}): MaterialItem => ({
  id, title: 'Дроби', description: '', name: 'Дроби.docx', kind: 'word', size: 52_000, shared: true, mine: true,
  author: 'Анна Сергеевна', createdAt: '2026-11-10T08:00:00Z', viewable: true, ...extra,
});

it('загрузка методички: файл и поля уходят формой, новая появляется в списке; чужие — отдельно', async () => {
  const colleague = item('c1', { title: 'Опыты по физике', kind: 'powerpoint', mine: false, author: 'Игорь Павлович' });
  api.mockImplementation(async (method) => (method === 'GET' ? [colleague] : item('m1', { title: 'План урока' })) as never);
  renderApp(<MaterialsLibrary />);
  const others = await screen.findByRole('region', { name: 'Методички коллег' });
  expect(others).toHaveTextContent('Опыты по физикеПрезентация · 51 КБ · Игорь Павлович');
  expect(within(others).queryByRole('button', { name: /Удалить/ })).not.toBeInTheDocument();

  const file = new File(['%PDF'], 'план.docx');
  fireEvent.change(screen.getByLabelText('Файл до 25 МБ'), { target: { files: [file] } });
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'План урока' } });
  fireEvent.click(screen.getByLabelText('Показать коллегам учреждения'));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Добавить' })));
  const [method, path, body] = api.mock.calls.at(-1)!;
  expect([method, path]).toEqual(['POST', '/teacher/materials']);
  expect((body as FormData).get('file')).toBe(file);
  expect((body as FormData).get('shared')).toBe('false');
  const mine = screen.getByRole('region', { name: 'Мои методички' });
  expect(within(mine).getByRole('link', { name: 'План урока' })).toHaveAttribute('href', '/materials/m1');
  expect(within(mine).getByRole('link', { name: 'Скачать: План урока' })).toHaveAttribute('href', '/api/teacher/materials/m1/file');
});

it('просмотр без скачивания: документ во встроенном окне, картинка картинкой', async () => {
  api.mockResolvedValue([item('m1'), item('p1', { title: 'Схема', kind: 'image', name: 'схема.png' })] as never);
  const view = (id: string) =>
    renderApp(<Routes><Route path="/materials/:id" element={<MaterialViewer materialId={id} />} /></Routes>, { route: `/materials/${id}` });
  const first = view('m1');
  expect(await screen.findByTitle('Просмотр: Дроби')).toHaveAttribute('src', '/api/teacher/materials/m1/view');
  expect(screen.getByRole('link', { name: /Во весь экран/ })).toHaveAttribute('target', '_blank');
  first.unmount();
  view('p1');
  expect(await screen.findByRole('img', { name: 'Схема' })).toHaveAttribute('src', '/api/teacher/materials/p1/view');
});
