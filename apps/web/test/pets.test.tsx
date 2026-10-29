import { beforeEach, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { DEFAULT_HERO, HERO_PARTS } from '@heroes/shared';
import { HeroEditor } from '../src/components/HeroEditor';
import { HeroAvatar } from '../src/components/HeroAvatar';
import { PetCompanion } from '../src/components/PetCompanion';
import { renderApp } from './render';

vi.mock('../src/api', async (orig) => ({ ...(await orig<typeof import('../src/api')>()), api: vi.fn() }));
const { api } = await import('../src/api');
beforeEach(() => vi.mocked(api).mockResolvedValue(HERO_PARTS.map((p) => ({ id: p.id, requiredLevel: p.requiredLevel, isPremium: !!p.premium }))));

it('быстрый переход открывает питомцев, выбор сохраняется вместе с героем, питомца можно убрать', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const view = renderApp(<HeroEditor initial={{ name: '', parts: DEFAULT_HERO }} level={1} onSave={save} />);
  await view.user.click(screen.getByRole('button', { name: 'Выбрать питомца' }));
  const tab = within(screen.getByRole('navigation', { name: 'Детали героя' })).getByRole('button', { name: 'Питомец' });
  expect(tab).toHaveFocus();
  expect(tab).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Без питомца' })).toHaveAttribute('aria-pressed', 'true');
  await view.user.click(screen.getByRole('button', { name: 'Искрик' }));
  await view.user.click(screen.getByRole('button', { name: 'Сохранить героя' }));
  expect(save).toHaveBeenCalledWith('', { ...DEFAULT_HERO, pet: 'pet.fox' });
  await view.user.click(screen.getByRole('button', { name: 'Без питомца' }));
  expect(screen.getByRole('button', { name: 'Сохранено' })).toBeDisabled();
});

it('подросший питомец виден в превью и подсказке, а сохранение не записывает стадию в детали', async () => {
  const parts = { ...DEFAULT_HERO, pet: 'pet.owl' };
  const save = vi.fn().mockResolvedValue(undefined);
  const { user, container } = renderApp(<HeroEditor initial={{ name: '', parts }} level={7} onSave={save} />);
  await user.click(screen.getByRole('button', { name: 'Изменить питомца' }));
  expect(within(screen.getByRole('region', { name: 'Рост питомца' })).getByText('7-й уровень · Хранитель')).toHaveAttribute('aria-current', 'step');
  expect(container.querySelector('[data-pet="pet.owl"]')).toHaveAttribute('data-pet-stage', '3');
  await user.click(screen.getByRole('button', { name: 'Листик' }));
  await user.click(screen.getByRole('button', { name: 'Сохранить героя' }));
  expect(save).toHaveBeenCalledWith('', { ...DEFAULT_HERO, pet: 'pet.sprout' });
});

it('обновление уровня меняет рисунок без повторного выбора питомца', () => {
  const parts = { ...DEFAULT_HERO, pet: 'pet.fox' };
  const view = renderApp(<HeroAvatar parts={parts} level={3} title="Герой" />);
  expect(view.container.querySelector('[data-pet]')).toHaveAttribute('data-pet-stage', '1');
  view.rerender(<HeroAvatar parts={parts} level={4} title="Герой" />);
  expect(view.container.querySelector('[data-pet]')).toHaveAttribute('data-pet-stage', '2');
  view.rerender(<HeroAvatar parts={parts} level={7} title="Герой" />);
  expect(view.container.querySelector('[data-pet]')).toHaveAttribute('data-pet-stage', '3');
});

it('профиль объясняет следующую стадию и не показывает пустой слот', () => {
  const view = renderApp(<PetCompanion parts={DEFAULT_HERO} level={1} />);
  expect(screen.queryByText(/Следующая стадия/)).not.toBeInTheDocument();
  view.rerender(<PetCompanion parts={{ ...DEFAULT_HERO, pet: 'pet.fox' }} level={4} />);
  expect(screen.getByText(/Напарник/)).toBeInTheDocument();
  expect(screen.getByText('Следующая стадия — на 7-м уровне героя.')).toBeInTheDocument();
});
