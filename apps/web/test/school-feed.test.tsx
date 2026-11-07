import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { pagesFor } from '../src/app/routes';
import { AdminSchoolFeed } from '../src/features/schoolfeed/components/AdminSchoolFeed';
import { SchoolFeed } from '../src/features/schoolfeed/components/SchoolFeed';
import type { AdminSchoolPost, SchoolPost } from '../src/lib/api';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
beforeEach(() => { api.mockReset(); });

const POST: SchoolPost = {
  id: 'p1', schoolName: 'Гимназия № 5', author: 'Ирина Львовна', text: 'Собрание в пятницу в 18:00', important: true,
  createdAt: '2026-11-07T08:00:00.000Z', unread: true,
  files: [{ id: 'f1', name: 'план.pdf', mime: 'application/pdf', size: 2048, createdAt: '2026-11-07T08:00:00.000Z' }],
};

it('адрес новостей школы', () => {
  expect(pagesFor('/school')).toEqual(['schoolNews']);
});

it('семья видит объявление выделенным, новое отмечено; название школы — только если школ несколько', async () => {
  api.mockResolvedValue([POST, { ...POST, id: 'p2', important: false, unread: false, text: 'Фото с праздника', files: [] }] as never);
  renderApp(<SchoolFeed />);
  const list = await screen.findByRole('list', { name: 'Записи школы' });
  const [announcement, news] = within(list).getAllByRole('article');
  expect(within(announcement).getByText('Объявление')).toBeVisible();
  expect(within(announcement).getByText('Новое')).toBeVisible();
  expect(within(announcement).getByRole('link', { name: /план\.pdf/ })).toHaveAttribute('href', '/api/files/f1');
  expect(within(news).queryByText('Объявление')).not.toBeInTheDocument();
  expect(within(news).queryByText('Новое')).not.toBeInTheDocument();
  expect(screen.queryByText(/Гимназия № 5 ·/)).not.toBeInTheDocument();
});

it('пустая лента школы объясняет, что здесь появится', async () => {
  api.mockResolvedValue([] as never);
  renderApp(<SchoolFeed />);
  expect(await screen.findByText('Новостей пока нет')).toBeVisible();
});

const ADMIN_POST: AdminSchoolPost = { ...POST, reach: { read: 3, total: 10, audience: 'families' } };

it('директор публикует объявление с файлом и видит, сколько семей прочитали; удаление после подтверждения', async () => {
  api.mockImplementation(async (method) => (method === 'GET' ? [] : method === 'POST' ? [ADMIN_POST] : []) as never);
  renderApp(<AdminSchoolFeed canWrite />);
  const publish = await screen.findByRole('button', { name: 'Опубликовать' });
  expect(publish).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Новая запись'), { target: { value: ' Собрание в пятницу в 18:00 ' } });
  fireEvent.click(screen.getByLabelText(/Объявление для всех семей/));
  const pdf = new File(['%PDF'], 'план.pdf', { type: 'application/pdf' });
  fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [pdf] } });
  await act(async () => fireEvent.click(publish));
  const [, path, body] = api.mock.calls.find(([method]) => method === 'POST')!;
  expect(path).toBe('/admin/school-feed');
  const form = body as FormData;
  const sent = [form.get('text'), form.get('important'), (form.get('file') as File).name];
  expect(sent).toEqual(['Собрание в пятницу в 18:00', 'true', 'план.pdf']);
  expect(await screen.findByText('Объявление отправлено всем семьям')).toBeVisible();
  expect(screen.getByText('Прочитали 3 из 10 семей')).toBeVisible();
  expect(screen.getByLabelText('Новая запись')).toHaveValue('');

  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Удалить запись' })));
  expect(api).toHaveBeenCalledWith('DELETE', '/admin/school-feed/p1');
  expect(screen.getByText('Записей пока нет.')).toBeVisible();
});

it('сотрудник читает ленту в панели, но не пишет и не удаляет', async () => {
  api.mockResolvedValue([ADMIN_POST] as never);
  renderApp(<AdminSchoolFeed canWrite={false} />);
  expect(await screen.findByText('Прочитали 3 из 10 семей')).toBeVisible();
  expect(screen.queryByLabelText('Новая запись')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Удалить' })).not.toBeInTheDocument();
});
