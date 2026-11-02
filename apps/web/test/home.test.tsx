import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { HomePoints } from '../src/features/home';
import type { HomeBoard } from '../src/lib/api';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
const PATH = '/parent/children/s1/home';
const POINT = { id: 'p1', goalId: 'g1', reason: 'Убрать комнату', points: 2, createdAt: '2026-11-02T10:00:00.000Z' };
const BOARD: HomeBoard = {
  total: 7,
  goals: [
    { id: 'g1', title: 'Убрать комнату', target: 10, progress: 2 },
    { id: 'g2', title: 'Прочитать книгу', target: 5, progress: 6 },
  ],
  history: [POINT],
};
const EMPTY: HomeBoard = { total: 0, goals: [], history: [] };

beforeEach(() => {
  api.mockReset();
});

function reply(board: HomeBoard) {
  api.mockImplementation(async (method) => (method === 'GET' ? board : { ok: true }) as never);
}
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

it('показывает сумму, прогресс и подсказку, что счёт отдельный от школьного', async () => {
  reply(BOARD);
  renderApp(<HomePoints path={PATH} editable />);
  expect(await screen.findByRole('heading', { name: 'Домашние баллы: 7' })).toBeVisible();
  expect(screen.getByText(/На школьные баллы, уровень героя и магазин они не влияют/)).toBeVisible();
  expect(screen.getByRole('progressbar', { name: 'Убрать комнату' })).toHaveAttribute('aria-valuetext', '2 из 10');
  // Перебор не показывается: 6 из 5 выглядело бы ошибкой
  expect(screen.getByRole('progressbar', { name: 'Прочитать книгу' })).toHaveAttribute('aria-valuetext', '5 из 5');
  expect(screen.getByText('Достигнута')).toBeVisible();
});

it('+1 начисляет балл в счёт цели, у достигнутой цели кнопки нет', async () => {
  reply(BOARD);
  renderApp(<HomePoints path={PATH} editable />);
  await screen.findByText('Прочитать книгу');
  expect(screen.queryByRole('button', { name: 'Добавить балл: Прочитать книгу' })).toBeNull();
  await act(async () => click('Добавить балл: Убрать комнату'));
  expect(api).toHaveBeenCalledWith('POST', `${PATH}/points`, { goalId: 'g1', reason: '', points: 1 });
  expect(api.mock.calls.filter(([method]) => method === 'GET')).toHaveLength(2);
});

it('в форме начисления только незавершённые цели; причина нужна, если цели нет', async () => {
  reply(BOARD);
  renderApp(<HomePoints path={PATH} editable />);
  await screen.findByText('Прочитать книгу');
  click('Начислить');
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveTextContent('Убрать комнату');
  expect(dialog).not.toHaveTextContent('Прочитать книгу');
  const submit = () => screen.getAllByRole('button', { name: 'Начислить' }).at(-1)!;
  expect(submit()).toBeDisabled();
  type('За что', 'Помог бабушке');
  type('Баллы, от 1 до 10', '11');
  expect(submit()).toBeDisabled();
  type('Баллы, от 1 до 10', '3');
  await act(async () => fireEvent.click(submit()));
  expect(api).toHaveBeenCalledWith('POST', `${PATH}/points`, { goalId: null, reason: 'Помог бабушке', points: 3 });
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('начисление в счёт цели проходит без причины', async () => {
  reply(BOARD);
  renderApp(<HomePoints path={PATH} editable />);
  await screen.findByText('Прочитать книгу');
  click('Начислить');
  type('Цель', 'g1');
  expect(screen.getByText(/в истории будет название цели/)).toBeVisible();
  await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'Начислить' }).at(-1)!));
  expect(api).toHaveBeenCalledWith('POST', `${PATH}/points`, { goalId: 'g1', reason: '', points: 1 });
});

it('пустой счёт зовёт поставить цель; цель создаётся и меняется', async () => {
  reply(EMPTY);
  renderApp(<HomePoints path={PATH} editable />);
  expect(await screen.findByText('Домашних целей пока нет')).toBeVisible();
  click('Новая цель');
  type('Цель', ' Читать ');
  type('Сколько баллов собрать', '0');
  expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  type('Сколько баллов собрать', '20');
  await act(async () => click('Сохранить'));
  expect(api).toHaveBeenCalledWith('POST', `${PATH}/goals`, { title: 'Читать', target: 20 });
});

it('цель можно изменить и удалить, начисление отменить', async () => {
  reply(BOARD);
  renderApp(<HomePoints path={PATH} editable />);
  await screen.findByText('Прочитать книгу');
  click('Изменить: Прочитать книгу');
  type('Сколько баллов собрать', '8');
  await act(async () => click('Сохранить'));
  expect(api).toHaveBeenCalledWith('PUT', `${PATH}/goals/g2`, { title: 'Прочитать книгу', target: 8 });
  click('Изменить: Убрать комнату');
  await act(async () => click('Удалить'));
  expect(api).toHaveBeenCalledWith('DELETE', `${PATH}/goals/g1`);
  await act(async () => click('Отменить начисление: Убрать комнату'));
  expect(api).toHaveBeenCalledWith('DELETE', `${PATH}/points/p1`);
});

it('ошибка сервера не закрывает окно и не теряет введённое', async () => {
  api.mockImplementation(async (method) => {
    if (method === 'GET') return BOARD as never;
    throw new Error('Эта цель уже достигнута');
  });
  renderApp(<HomePoints path={PATH} editable />);
  await screen.findByText('Прочитать книгу');
  click('Новая цель');
  type('Цель', 'Читать');
  await act(async () => click('Сохранить'));
  expect(await screen.findByText('Эта цель уже достигнута')).toBeVisible();
  expect(screen.getByLabelText('Цель')).toHaveValue('Читать');
});

it('ученик только смотрит: кнопок нет, история короткая', async () => {
  reply({ ...BOARD, history: Array.from({ length: 8 }, (_, i) => ({ ...POINT, id: `p${i}`, reason: `Дело ${i}` })) });
  renderApp(<HomePoints path="/student/home" />);
  expect(await screen.findByRole('heading', { name: 'Домашние баллы: 7' })).toBeVisible();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText('Дело 4')).toBeVisible();
  expect(screen.queryByText('Дело 5')).toBeNull();
});

it('у ученика пустой счёт не занимает место', async () => {
  reply(EMPTY);
  const { container } = renderApp(<HomePoints path="/student/home" />);
  await act(async () => { await Promise.resolve(); });
  expect(api).toHaveBeenCalledWith('GET', '/student/home');
  expect(container.textContent).toBe('');
});

it('ошибка загрузки предлагает повторить', async () => {
  api.mockRejectedValueOnce(new Error('Нет связи'));
  api.mockResolvedValueOnce(EMPTY as never);
  renderApp(<HomePoints path={PATH} editable />);
  expect(await screen.findByText('Нет связи')).toBeVisible();
  click('Повторить');
  expect(await screen.findByText('Домашних целей пока нет')).toBeVisible();
});
