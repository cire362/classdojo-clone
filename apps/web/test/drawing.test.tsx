import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { CANVAS, EMPTY, addStroke, redo, toCanvas, undo, type Stroke } from '../src/features/works/drawing';
import { WorkForm } from '../src/features/works/components/WorkForm';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
vi.mock('../src/lib/photo', () => ({ prepareImage: vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' })) }));
const api = vi.mocked((await import('../src/lib/api')).api);
const { prepareImage } = vi.mocked(await import('../src/lib/photo'));

/** В jsdom нет холста: подменяем контекст и снимок в PNG, запоминая, что рисовалось */
const calls: string[] = [];
beforeEach(() => {
  api.mockReset();
  prepareImage.mockClear();
  calls.length = 0;
  const ctx = new Proxy({}, { get: (_, name) => (name in {} ? undefined : (...args: unknown[]) => calls.push(`${String(name)}:${args.length}`)) });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['png'], { type: 'image/png' })));
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 300, height: 225 } as DOMRect);
});

const line: Stroke = { color: '#e03131', size: 16, erase: false, points: [[10, 10], [50, 50]] };

it('штрихи: отмена и повтор, новый штрих сбрасывает повтор', () => {
  const one = addStroke(EMPTY, line);
  const two = addStroke(one, { ...line, color: '#1c7ed6' });
  expect(undo(two)).toEqual({ strokes: [line], undone: [two.strokes[1]] });
  expect(redo(undo(two))).toEqual({ strokes: two.strokes, undone: [] });
  expect(addStroke(undo(two), line).undone).toEqual([]);
  expect(undo(EMPTY)).toBe(EMPTY);
});

it('точка экрана переводится в точки холста и не выходит за лист', () => {
  const rect = { left: 100, top: 50, width: 300, height: 225 };
  expect(toCanvas(250, 162.5, rect)).toEqual([CANVAS.width / 2, CANVAS.height / 2]);
  expect(toCanvas(0, 1000, rect)).toEqual([0, CANVAS.height]);
});

function draw(canvas: HTMLElement) {
  fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 30, clientY: 30 });
  fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 90, clientY: 60 });
  fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 150, clientY: 120 });
  fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 150, clientY: 120 });
}

it('рисунок прикладывается к работе как PNG без пережатия и уходит вместе с ней', async () => {
  api.mockImplementation(async (_, path) =>
    (path === '/student/works/recipients' ? { curator: 'Анна Сергеевна', subjects: [] } : []) as never);
  renderApp(<WorkForm onSubmitted={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Нарисовать' }));
  const dialog = await screen.findByRole('dialog', { name: 'Рисунок' });
  const done = within(dialog).getByRole('button', { name: 'Готово: приложить к работе' });
  expect(done).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Синий' }));
  expect(within(dialog).getByRole('button', { name: 'Синий' })).toHaveAttribute('aria-pressed', 'true');
  draw(within(dialog).getByRole('img', { name: /Лист для рисования/ }));
  expect(calls.some((c) => c.startsWith('lineTo'))).toBe(true);

  // Отмена и повтор работают с кнопок, а закрытое окно не теряет рисунок
  fireEvent.click(within(dialog).getByRole('button', { name: 'Отменить' }));
  expect(done).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Вернуть' }));
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.click(await screen.findByRole('button', { name: 'Продолжить рисунок' }));
  await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Готово: приложить к работе' })));

  expect(screen.getByRole('list', { name: 'Выбранные файлы' })).toHaveTextContent('рисунок.png');
  expect(screen.getByLabelText('Название')).toHaveValue('Рисунок');
  expect(screen.getByRole('button', { name: 'Нарисовать' })).toBeVisible();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Отправить' })));
  const file = (api.mock.calls.find(([method]) => method === 'POST')![2] as FormData).get('file') as File;
  expect([file.name, file.type]).toEqual(['рисунок.png', 'image/png']);
  expect(prepareImage).not.toHaveBeenCalled();
});

it('очистка листа — после подтверждения', async () => {
  renderApp(<WorkForm onSubmitted={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Нарисовать' }));
  const dialog = await screen.findByRole('dialog', { name: 'Рисунок' });
  draw(within(dialog).getByRole('img', { name: /Лист для рисования/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Очистить' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Точно очистить' }));
  expect(within(dialog).getByRole('button', { name: 'Готово: приложить к работе' })).toBeDisabled();
  expect(within(dialog).getByRole('button', { name: 'Вернуть' })).toBeDisabled();
});
