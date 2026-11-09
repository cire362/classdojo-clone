import { screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { InstitutionKind } from '@heroes/shared/terms';
import { TermsProvider } from '../src/features/auth';
import { MyWorks } from '../src/features/works';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => {
  api.mockReset();
  api.mockImplementation(async (_, path) =>
    (path === '/student/works/recipients' ? { curator: 'Анна Сергеевна', subjects: [] } : []) as never);
});

const works = (kind: InstitutionKind) => renderApp(<TermsProvider kind={kind}><MyWorks /></TermsProvider>);

it('студент колледжа сдаёт доклады и проекты: без рисования, поделок и родителей', async () => {
  works('COLLEGE');
  expect(await screen.findByText('Отправьте доклад, проект или отчёт: после проверки работа появится в портфолио.')).toBeVisible();
  expect(screen.getByText('После проверки работа попадёт в портфолио.')).toBeVisible();
  expect(await screen.findByText('Куратор группы — Анна Сергеевна')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Нарисовать/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Прикрепить/ })).toBeVisible();
});

it('у школьника по-прежнему рисунок, поделка и родители', async () => {
  works('SCHOOL');
  expect(await screen.findByText(/рисунок, доклад или фото поделки/)).toBeVisible();
  expect(screen.getByText(/Родители увидят работу/)).toBeVisible();
  expect(await screen.findByText('Классный руководитель — Анна Сергеевна')).toBeVisible();
  expect(screen.getByRole('button', { name: /Нарисовать/ })).toBeVisible();
});
