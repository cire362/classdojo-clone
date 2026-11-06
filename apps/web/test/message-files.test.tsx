import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { BroadcastButton } from '../src/features/messages/components/BroadcastButton';
import { Thread } from '../src/features/messages/components/Thread';
import type { ChatMessage } from '../src/lib/api';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
vi.mock('../src/lib/photo', () => ({ prepareImage: vi.fn(async (file: File) => new Blob([`мал-${file.name}`], { type: 'image/jpeg' })) }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

const pdf = (name: string, size = 10) => new File(['x'.repeat(size)], name, { type: 'application/pdf' });
const photo = (name: string) => new File(['x'], name, { type: 'image/heic' });
const pick = (files: File[]) => fireEvent.change(document.querySelector('input[type=file]')!, { target: { files } });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

it('сообщение из одних файлов: фото уходит уменьшенным JPEG, PDF как есть', async () => {
  const send = vi.fn().mockResolvedValue([]);
  renderApp(<Thread messages={[]} send={send} emptyText="Пусто" />);
  expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled();
  pick([pdf('справка.pdf'), photo('IMG_0001.HEIC')]);
  expect(screen.getByRole('list', { name: 'Выбранные файлы' })).toHaveTextContent('справка.pdfIMG_0001.HEIC');
  await act(async () => click('Отправить'));
  const [{ text, files }] = send.mock.calls[0];
  expect(text).toBe('');
  expect(files.map((f: File) => [f.name, f.type])).toEqual([['справка.pdf', 'application/pdf'], ['IMG_0001.jpg', 'image/jpeg']]);
  expect(files[1].size).toBe(new Blob(['мал-IMG_0001.HEIC']).size);
  expect(screen.queryByRole('list', { name: 'Выбранные файлы' })).not.toBeInTheDocument();
});

it('неподходящие и лишние файлы не прикладываются; выбранный можно убрать', async () => {
  renderApp(<Thread messages={[]} send={vi.fn()} emptyText="Пусто" />);
  pick([new File(['x'], 'план.docx'), pdf('большой.pdf', 11 * 1024 * 1024)]);
  expect(await screen.findByText('план.docx: подходят только фото и PDF')).toBeVisible();
  expect(screen.getByText('большой.pdf: файл больше 10 МБ')).toBeVisible();
  expect(screen.queryByRole('list', { name: 'Выбранные файлы' })).not.toBeInTheDocument();

  pick(Array.from({ length: 6 }, (_, i) => pdf(`${i}.pdf`)));
  expect(await screen.findByText('К сообщению можно приложить не больше 5 файлов')).toBeVisible();
  expect(screen.getAllByRole('button', { name: /^Убрать/ })).toHaveLength(5);
  expect(screen.getByRole('button', { name: 'Прикрепить' })).toBeDisabled();
  click('Убрать 0.pdf');
  expect(screen.getAllByRole('button', { name: /^Убрать/ })).toHaveLength(4);
});

it('вложения в переписке: фото миниатюрой, PDF ссылкой на скачивание с размером', () => {
  const message: ChatMessage = {
    id: 'm1', text: '', createdAt: '2030-01-15T09:30:00.000Z', mine: false, author: 'Родитель', fromParent: true, scheduled: false,
    files: [
      { id: 'f1', name: 'справка.pdf', mime: 'application/pdf', size: 1_300_000, createdAt: '2030-01-15T09:30:00.000Z' },
      { id: 'f2', name: 'фото.jpg', mime: 'image/jpeg', size: 90_000, createdAt: '2030-01-15T09:30:00.000Z' },
    ],
  };
  renderApp(<Thread messages={[message]} send={vi.fn()} emptyText="Пусто" />);
  expect(screen.getByRole('img', { name: 'Фото 1: фото.jpg' })).toHaveAttribute('src', '/api/files/f2?size=preview');
  expect(screen.getByRole('link', { name: 'Фото 1: фото.jpg' })).toHaveAttribute('href', '/api/files/f2');
  const link = screen.getByRole('link', { name: /справка\.pdf/ });
  expect(link).toHaveAttribute('href', '/api/files/f1');
  expect(link).toHaveAttribute('download', 'справка.pdf');
  expect(link).toHaveTextContent('1,2 МБ');
});

it('рассылка с файлом уходит одним запросом multipart', async () => {
  api.mockResolvedValue({ sent: 2 } as never);
  renderApp(<BroadcastButton groupId="g1" />);
  click('Написать родителям');
  fireEvent.change(screen.getByLabelText('Сообщение'), { target: { value: 'Расписание' } });
  pick([pdf('расписание.pdf')]);
  await act(async () => click('Отправить всем'));
  const [, path, body] = api.mock.calls[0];
  expect(path).toBe('/teacher/groups/g1/messages');
  expect(body).toBeInstanceOf(FormData);
  expect((body as FormData).get('text')).toBe('Расписание');
  expect(((body as FormData).get('file') as File).name).toBe('расписание.pdf');
  expect(await screen.findByText('Отправлено: 2 родителям')).toBeVisible();
});
