import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { DEFAULT_HERO, HERO_PARTS } from '@heroes/shared';
import { HeroEditor } from '../src/components/HeroEditor';
import { renderApp } from './render';

vi.mock('../src/api', async (orig) => ({ ...(await orig<typeof import('../src/api')>()), api: vi.fn() }));
const { api } = await import('../src/api');

beforeEach(() => {
  vi.mocked(api).mockImplementation(async (_m: string, path: string) => {
    if (path === '/hero-parts') return HERO_PARTS.map((p) => ({ id: p.id, requiredLevel: p.requiredLevel, isPremium: false }));
    throw new Error(`unexpected ${path}`);
  });
});

const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Детали героя' })).getByRole('button', { name: new RegExp(`^${name}`) });

describe('конструктор героя', () => {
  it('закрытая деталь не выбирается и объясняет, когда откроется', async () => {
    const onSave = vi.fn();
    const { user } = renderApp(<HeroEditor initial={{ name: '', parts: DEFAULT_HERO }} level={1} onSave={onSave} />);
    await user.click(tab('Маска'));
    const helmet = await screen.findByRole('button', { name: /Шлем, откроется на 5 уровне/ });
    await user.click(helmet);
    expect(await screen.findByText('Откроется на 5 уровне')).toBeInTheDocument();
    expect(helmet).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Сохранено' })).toBeDisabled();
  });

  it('выбор открытой детали и имени сохраняется', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { user } = renderApp(<HeroEditor initial={{ name: '', parts: DEFAULT_HERO }} level={1} onSave={onSave} />);
    await user.click(tab('Маска'));
    await user.click(screen.getByRole('button', { name: 'Без маски' }));
    await user.type(screen.getByLabelText(/Имя героя/), 'Капитан Дробь');
    await user.click(screen.getByRole('button', { name: 'Сохранить героя' }));
    expect(onSave).toHaveBeenCalledWith('Капитан Дробь', { ...DEFAULT_HERO, mask: 'mask.none' });
    expect(await screen.findByText('Герой сохранён')).toBeInTheDocument();
  });

  it('новые детали помечены, открывается вкладка с ними', async () => {
    renderApp(
      <HeroEditor initial={{ name: '', parts: DEFAULT_HERO }} level={2} newIds={new Set(['mask.bandana'])} onSave={vi.fn()} />,
    );
    expect(tab('Маска')).toHaveAttribute('aria-pressed', 'true');
    const bandana = screen.getByRole('button', { name: 'Повязка' });
    expect(within(bandana).getByText('новое')).toBeInTheDocument();
  });
});
