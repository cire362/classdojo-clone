import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_HERO } from '@heroes/shared';
import type { WorldState } from '@heroes/shared/api';
import { GARDEN_LEVELS } from '@heroes/shared/world';
import { StudentWorld } from '../src/features/world/components/StudentWorld';
import { GardenBoard } from '../src/features/world/components/GardenBoard';
import { renderApp } from './render';
vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
const state: WorldState = { completed: [], available: true, reason: null, hero: { parts: DEFAULT_HERO, level: 1 } };
const first = ['right', 'right', 'right', 'right', 'down', 'down', 'down', 'down'];
beforeEach(() => { api.mockReset(); });

it('сад открыт сразу: решённое место сохраняется, и открывается следующее', async () => {
  api.mockImplementation(async (method) => (method === 'POST' ? { ...state, completed: ['landing'] } : state) as never);
  renderApp(<StudentWorld />);
  expect(await screen.findByRole('heading', { name: 'Тихий причал' })).toBeVisible();
  expect(screen.getByRole('button', { name: /2. Ручей встреч/ })).toBeDisabled();
  for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Вправо' }));
  for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Вниз' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Зажечь маяк' })));
  expect(api).toHaveBeenCalledWith('POST', '/student/world/solve', { levelId: 'landing', moves: first });
  expect(await screen.findByText('Место «Тихий причал» восстановлено!')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Ручей встреч' })).toBeVisible();
  expect(screen.getByRole('button', { name: /2. Ручей встреч/ })).toBeEnabled();
});

it('архив закрывает сад и прячет поле; ошибка сети допускает повтор', async () => {
  api.mockRejectedValueOnce(new Error('Нет связи'));
  renderApp(<StudentWorld />);
  expect(await screen.findByText('Нет связи')).toBeVisible();
  api.mockResolvedValue({ ...state, available: false, reason: 'Группа в архиве. Сад закрыт.' } as never);
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  expect(await screen.findByText('Группа в архиве. Сад закрыт.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Вправо' })).not.toBeInTheDocument();
});

it('стрелки клавиатуры двигают героя, камни не расходуют ход, отмена и сброс работают', async () => {
  const solve = vi.fn().mockResolvedValue(true);
  renderApp(<GardenBoard level={GARDEN_LEVELS[0]} hero={state.hero} disabled={false} onSolve={solve} />);
  const board = screen.getByRole('group', { name: /Поле маршрута/ });
  fireEvent.keyDown(board, { key: 'ArrowLeft' });
  expect(screen.getByText(/Здесь камень/)).toBeVisible();
  fireEvent.keyDown(board, { key: 'ArrowRight' });
  fireEvent.click(screen.getByRole('button', { name: 'Отменить шаг' }));
  expect(screen.getByText(/Шаги: 0 из 8/)).toBeVisible();
  for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Вправо' }));
  for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Вниз' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Зажечь маяк' })));
  expect(solve).toHaveBeenCalledWith(['right', 'right', 'right', 'right', 'down', 'down', 'down', 'down']);
  expect(screen.getByText(/Место восстановлено/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Сначала' }));
  expect(screen.getByRole('button', { name: 'Зажечь маяк' })).toBeDisabled();
});
