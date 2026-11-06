import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { BroadcastButton } from '../src/features/messages/components/BroadcastButton';
import { QuietHoursCard } from '../src/features/messages/components/QuietHoursCard';
import { Thread } from '../src/features/messages/components/Thread';
import type { ChatMessage } from '../src/lib/api';
import { localDateTime } from '../src/lib/hooks';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

const MESSAGE: ChatMessage = { id: 'm1', text: 'Собрание', createdAt: '2030-01-15T09:30:00.000Z', mine: true, author: 'Анна', fromParent: false, scheduled: true, files: [] };
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

it('время для поля datetime-local собирается по местному времени', () => {
  expect(localDateTime(new Date(2030, 0, 5, 7, 3))).toBe('2030-01-05T07:03');
});

it('преподаватель откладывает сообщение: без времени кнопка закрыта, флажок сбрасывается', async () => {
  const send = vi.fn().mockResolvedValue([MESSAGE]);
  renderApp(<Thread messages={[]} send={send} cancel={vi.fn()} emptyText="Пусто" />);
  fireEvent.change(screen.getByLabelText('Сообщение'), { target: { value: 'Собрание' } });
  fireEvent.click(screen.getByLabelText('Отправить позже'));
  expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Дата и время отправки'), { target: { value: '2030-01-15T09:30' } });
  await act(async () => click('Отправить'));
  expect(send).toHaveBeenCalledWith({ text: 'Собрание', sendAt: new Date('2030-01-15T09:30').toISOString(), files: [] });
  expect(screen.getByText('Уйдёт в это время')).toBeVisible();
  expect(screen.getByLabelText('Отправить позже')).not.toBeChecked();
});

it('отложенное сообщение можно отменить', async () => {
  const cancel = vi.fn().mockResolvedValue([]);
  renderApp(<Thread messages={[MESSAGE]} send={vi.fn()} cancel={cancel} emptyText="Пусто" />);
  await act(async () => click('Отменить отправку'));
  expect(cancel).toHaveBeenCalledWith('m1');
  expect(screen.getByText('Пусто')).toBeVisible();
});

it('родитель отложить не может', () => {
  renderApp(<Thread messages={[]} send={vi.fn()} emptyText="Пусто" />);
  expect(screen.queryByLabelText('Отправить позже')).not.toBeInTheDocument();
});

it('рассылка уходит всем и сообщает сколько', async () => {
  api.mockResolvedValue({ sent: 3 } as never);
  renderApp(<BroadcastButton groupId="g1" />);
  click('Написать родителям');
  fireEvent.change(screen.getByLabelText('Сообщение'), { target: { value: ' Субботник ' } });
  await act(async () => click('Отправить всем'));
  expect(api).toHaveBeenCalledWith('POST', '/teacher/groups/g1/messages', { text: 'Субботник', sendAt: undefined });
  expect(await screen.findByText('Отправлено: 3 родителям')).toBeVisible();
});

it('ошибка рассылки оставляет текст', async () => {
  api.mockRejectedValue(new Error('В группе пока нет родителей с входом'));
  renderApp(<BroadcastButton groupId="g1" />);
  click('Написать родителям');
  fireEvent.change(screen.getByLabelText('Сообщение'), { target: { value: 'Текст' } });
  await act(async () => click('Отправить всем'));
  expect(await screen.findByText('В группе пока нет родителей с входом')).toBeVisible();
  expect(screen.getByLabelText('Сообщение')).toHaveValue('Текст');
});

it('рассылку можно запланировать', async () => {
  api.mockResolvedValue({ sent: 1 } as never);
  renderApp(<BroadcastButton groupId="g1" />);
  click('Написать родителям');
  fireEvent.change(screen.getByLabelText('Сообщение'), { target: { value: 'Завтра' } });
  fireEvent.click(screen.getByLabelText('Отправить позже'));
  fireEvent.change(screen.getByLabelText('Дата и время отправки'), { target: { value: '2030-01-15T09:30' } });
  await act(async () => click('Запланировать'));
  expect(await screen.findByText('Запланировано: 1 родителю')).toBeVisible();
});

it('тихие часы загружаются, сохраняются и выключаются', async () => {
  api.mockImplementation(async (method) => (method === 'GET' ? { hours: { from: '22:00', to: '07:00' } } : { hours: null }) as never);
  renderApp(<QuietHoursCard />);
  expect(await screen.findByLabelText('С')).toHaveValue('22:00');
  fireEvent.change(screen.getByLabelText('До'), { target: { value: '22:00' } });
  expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('До'), { target: { value: '08:00' } });
  await act(async () => click('Сохранить'));
  expect(api).toHaveBeenCalledWith('PUT', '/teacher/me/quiet-hours', { hours: { from: '22:00', to: '08:00' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Включить тихие часы' }));
  expect(screen.queryByLabelText('С')).not.toBeInTheDocument();
  await act(async () => click('Сохранить'));
  expect(api).toHaveBeenLastCalledWith('PUT', '/teacher/me/quiet-hours', { hours: null });
  expect(await screen.findByText('Тихие часы выключены')).toBeVisible();
});
