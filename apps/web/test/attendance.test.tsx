import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { AttendancePage } from '../src/pages/teacher/Attendance';
import type { AttendanceDay } from '../src/lib/api';
import { groupData, renderInGroup } from './group-harness';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const { api } = await import('../src/lib/api');

let day: AttendanceDay;

beforeEach(() => {
  day = { date: '', lesson: 1, lessons: [], session: null };
  vi.mocked(api).mockImplementation(async (method: string, path: string) => {
    if (method === 'GET' && path.startsWith('/teacher/groups/g1/attendance?date=')) {
      const date = new URLSearchParams(path.split('?')[1]).get('date')!;
      return { ...day, date };
    }
    if (method === 'POST' && path === '/teacher/groups/g1/attendance') return { ok: true };
    throw new Error(`unexpected ${method} ${path}`);
  });
});

const lastSave = () =>
  vi.mocked(api).mock.calls.filter(([m, p]) => m === 'POST' && p === '/teacher/groups/g1/attendance').at(-1)?.[2] as {
    presentStudentIds: string[];
    lesson: number;
    peopleOnPhoto: number | null;
  };

describe('отметка посещаемости', () => {
  it('без фото: по умолчанию все присутствуют, снятая отметка уходит на сервер', async () => {
    const { user } = renderInGroup(<AttendancePage />, groupData(), 'attendance');
    await user.click(await screen.findByRole('button', { name: 'Без фото' }));
    expect(screen.getByRole('heading', { name: 'Отмечено 2 из 2' })).toBeInTheDocument();
    await user.click(screen.getByText('Петя Смирнов'));
    expect(screen.getByRole('heading', { name: 'Отмечено 1 из 2' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText(/Посещаемость.*сохранена/)).toBeInTheDocument();
    expect(lastSave()).toMatchObject({ presentStudentIds: ['s1'], lesson: 1, peopleOnPhoto: null });
  });

  it('повторная отметка дня подставляет прежнюю и предлагает «Ещё урок»', async () => {
    day = {
      date: '',
      lesson: 1,
      lessons: [{ lesson: 1, presentCount: 1, studentsTotal: 2, peopleOnPhoto: 2 }],
      session: { peopleOnPhoto: 2, subtractedTeacher: true, presentStudentIds: ['s2'], markedStudentIds: ['s1', 's2'] },
    };
    const { user } = renderInGroup(<AttendancePage />, groupData(), 'attendance');
    expect(await screen.findByText(/уже отмечено: были 1 из 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ещё урок/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Без фото' }));
    expect(screen.getByRole('heading', { name: 'Отмечено 1 из 2' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText(/сохранена/)).toBeInTheDocument();
    expect(lastSave()).toMatchObject({ presentStudentIds: ['s2'], lesson: 1 });
  });

  it('архивная группа: отмечать нельзя', async () => {
    renderInGroup(<AttendancePage />, groupData({ archivedAt: '2026-06-01T00:00:00.000Z' }), 'attendance');
    expect(screen.getByText(/Группа в архиве, отмечать посещаемость нельзя/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Без фото' })).not.toBeInTheDocument();
  });
});
