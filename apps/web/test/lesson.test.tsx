import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { LessonPage } from '../src/pages/teacher/Lesson';
import { groupData, renderInGroup } from './group-harness';

vi.mock('../src/api', async (orig) => ({ ...(await orig<typeof import('../src/api')>()), api: vi.fn() }));
const { api } = await import('../src/api');

beforeEach(() => {
  vi.mocked(api).mockImplementation(async (_m: string, path: string, body?: unknown) => {
    if (path === '/teacher/groups/g1/points') {
      const { studentIds, reasonId } = body as { studentIds: string[]; reasonId: string };
      const value = reasonId === 'r1' ? 2 : -1;
      return {
        value,
        eventIds: studentIds.map((id) => `e-${id}`),
        summaries: Object.fromEntries(studentIds.map((id) => [id, { todayEarned: value > 0 ? value : 0, totalEarned: 10, level: 2 }])),
      };
    }
    throw new Error(`unexpected ${path}`);
  });
});

describe('экран урока', () => {
  it('клик по герою → причина → баллы начислены, карточка обновилась', async () => {
    const { user } = renderInGroup(<LessonPage />, groupData());
    await user.click(screen.getByRole('button', { name: /^Маша Иванова/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Маша Иванова' });
    await user.click(within(dialog).getByRole('button', { name: /Отличная работа/ }));
    expect(api).toHaveBeenCalledWith('POST', '/teacher/groups/g1/points', { studentIds: ['s1'], reasonId: 'r1' });
    expect(await screen.findByText('Маша: +2, отличная работа')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Маша Иванова всего 10/ })).toBeInTheDocument();
  });

  it('списание на общем экране показывается без числа и причины', async () => {
    const { user } = renderInGroup(<LessonPage />, groupData());
    await user.click(screen.getByRole('button', { name: /^Петя Смирнов/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Опоздал/ }));
    expect(await screen.findByText('Записано')).toBeInTheDocument();
    expect(screen.queryByText(/Петя: −1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/опоздал/)).not.toBeInTheDocument();
  });

  it('«Всей группе» и выбор нескольких учеников', async () => {
    const { user } = renderInGroup(<LessonPage />, groupData());
    await user.click(screen.getByRole('button', { name: 'Всей группе' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Вся группа' })).getByRole('button', { name: /Отличная работа/ }));
    expect(api).toHaveBeenLastCalledWith('POST', '/teacher/groups/g1/points', { studentIds: ['s1', 's2'], reasonId: 'r1' });

    await user.click(screen.getByRole('button', { name: 'Несколько' }));
    await user.click(screen.getByRole('button', { name: /^Петя Смирнов/ }));
    expect(screen.getByText('Выбрано: 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Начислить' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Опоздал/ }));
    expect(api).toHaveBeenLastCalledWith('POST', '/teacher/groups/g1/points', { studentIds: ['s2'], reasonId: 'r2' });
  });

  it('уровень вырос — сообщение о новом уровне', async () => {
    const { user } = renderInGroup(<LessonPage />, groupData());
    await user.click(screen.getByRole('button', { name: /^Маша Иванова/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Отличная работа/ }));
    expect(await screen.findByText('Новый уровень: Маша!')).toBeInTheDocument();
  });

  it('архивная группа: начислять нельзя, карточка открывает профиль', async () => {
    const { user } = renderInGroup(<LessonPage />, groupData({ archivedAt: '2026-06-01T00:00:00.000Z' }));
    expect(screen.queryByRole('button', { name: 'Всей группе' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Маша Иванова/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/s/s1');
    expect(api).not.toHaveBeenCalled();
  });

  it('командный режим: карточки по командам, счёт за сегодня и начисление всей команде', async () => {
    localStorage.setItem('heroes:teams:g1', '1');
    const data = groupData();
    data.teams = [
      { id: 't1', name: 'Кометы', color: '#e63946' },
      { id: 't2', name: 'Ракеты', color: '#2f6fde' },
    ];
    data.students = [
      { ...data.students[0], teamId: 't1', todayEarned: 0 },
      { ...data.students[1], teamId: 't2', todayEarned: 1 },
    ];
    const { user } = renderInGroup(<LessonPage />, data);
    const rockets = screen.getByRole('region', { name: 'Команда Ракеты' });
    expect(within(rockets).getByText('лидер')).toBeInTheDocument();
    expect(within(rockets).getByRole('button', { name: /^Петя Смирнов/ })).toBeInTheDocument();

    const comets = screen.getByRole('region', { name: 'Команда Кометы' });
    await user.click(within(comets).getByRole('button', { name: 'Начислить команде' }));
    const dialog = await screen.findByRole('dialog', { name: 'Команда «Кометы»' });
    await user.click(within(dialog).getByRole('button', { name: /Отличная работа/ }));
    expect(api).toHaveBeenCalledWith('POST', '/teacher/groups/g1/points', { studentIds: ['s1'], reasonId: 'r1' });
    // Теперь у «Комет» +2 и они лидируют
    expect(await within(comets).findByText('лидер')).toBeInTheDocument();
    localStorage.removeItem('heroes:teams:g1');
  });
});
