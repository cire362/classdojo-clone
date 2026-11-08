import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { TermsProvider } from '../src/features/auth';
import { NewYearModal } from '../src/features/schoolyear';
import type { SchoolYearPreview } from '../src/lib/api';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => {
  api.mockReset();
});

const PREVIEW: SchoolYearPreview = {
  lastStartedAt: null,
  recent: false,
  maxCourse: 11,
  groups: [
    { id: 'g5', name: '5 «А»', course: 5, students: 25, nextName: '6 «А»', graduate: false },
    { id: 'g9', name: '9 «Б»', course: 9, students: 20, nextName: '10 «Б»', graduate: false },
    { id: 'g11', name: '11 «А»', course: 11, students: 18, nextName: '11 «А»', graduate: true },
  ],
  withoutCourse: [{ id: 'k', name: 'Кружок робототехники' }],
};

it('школа: видно, что станет с каждым классом; выпуск отмечается и уходит в запрос', async () => {
  api.mockImplementation(async (method) => (method === 'GET' ? PREVIEW : { promoted: 1, graduated: 2, renamed: 1 }) as never);
  const onDone = vi.fn();
  renderApp(<TermsProvider kind="SCHOOL"><NewYearModal onClose={() => {}} onDone={onDone} /></TermsProvider>);
  const list = await screen.findByRole('list', { name: 'Что произойдёт с группами' });
  const [fifth, ninth, eleventh] = within(list).getAllByRole('listitem');
  expect(fifth).toHaveTextContent('параллель 5 → 6, станет «6 «А»»');
  expect(eleventh).toHaveTextContent('параллель 11 → выпуск, в архив');
  expect(screen.getByText('Номер не задан, не изменятся: Кружок робототехники.')).toBeVisible();

  fireEvent.click(within(ninth).getByLabelText('Выпуск'));
  expect(ninth).toHaveTextContent('параллель 9 → выпуск, в архив');
  fireEvent.click(screen.getByLabelText('Менять номер в названии группы'));
  expect(fifth).toHaveTextContent('параллель 5 → 6');
  expect(fifth).not.toHaveTextContent('станет');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Перевести 3 группы' })));
  expect(api).toHaveBeenCalledWith('POST', '/admin/school-year', { graduateIds: ['g11', 'g9'], rename: false, force: false });
  expect(await screen.findByText('Переведено: 1, выпущено: 2')).toBeInTheDocument();
  expect(onDone).toHaveBeenCalled();
});

it('недавний переход нужно подтвердить', async () => {
  api.mockResolvedValue({ ...PREVIEW, lastStartedAt: '2026-09-01T09:00:00.000Z', recent: true } as never);
  renderApp(<TermsProvider kind="COLLEGE"><NewYearModal onClose={() => {}} onDone={() => {}} /></TermsProvider>);
  const button = await screen.findByRole('button', { name: 'Перевести 3 группы' });
  expect(screen.getByText(/Прошлый переход:/)).toBeVisible();
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Да, перевести ещё раз'));
  expect(button).toBeEnabled();
});
