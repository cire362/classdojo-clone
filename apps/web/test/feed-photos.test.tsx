import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { GroupFeed } from '../src/features/feed/components/GroupFeed';
import { PostForm } from '../src/features/feed/components/PostForm';
import { PostPhotos } from '../src/features/feed/components/PostPhotos';
import { RenameModal } from '../src/features/students/components/RenameModal';
import type { LessonStudent } from '../src/lib/api';
import { groupData, renderInGroup } from './group-harness';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
vi.mock('../src/lib/photo', () => ({ prepareImage: vi.fn(async (file: File) => new Blob([`мал-${file.name}`], { type: 'image/jpeg' })) }));
const api = vi.mocked((await import('../src/lib/api')).api);
const { prepareImage } = vi.mocked(await import('../src/lib/photo'));
const PATH = '/teacher/groups/g1/feed';

let urls = 0;
beforeEach(() => {
  api.mockReset();
  prepareImage.mockClear();
  urls = 0;
  URL.createObjectURL = vi.fn(() => `blob:photo-${++urls}`);
  URL.revokeObjectURL = vi.fn();
});

const image = (name: string) => new File(['x'], name, { type: 'image/jpeg' });
const pick = (files: File[]) => fireEvent.change(document.querySelector('input[type=file]')!, { target: { files } });

it('сетка превью открывает снимок целиком, стрелки листают по кругу', async () => {
  renderApp(<PostPhotos ids={['f1', 'f2', 'f3']} />);
  const grid = screen.getByRole('list', { name: 'Фото' });
  // Превью внутри кнопок без своего названия: имя у кнопки
  expect([...grid.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toEqual([
    '/api/files/f1?size=preview', '/api/files/f2?size=preview', '/api/files/f3?size=preview',
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Открыть фото 2 из 3' }));
  expect(screen.getByRole('img', { name: 'Фото 2 из 3' })).toHaveAttribute('src', '/api/files/f2');
  fireEvent.click(screen.getByRole('button', { name: /Дальше/ }));
  fireEvent.click(screen.getByRole('button', { name: /Дальше/ }));
  expect(screen.getByRole('img', { name: 'Фото 1 из 3' })).toBeVisible();
  fireEvent.keyDown(screen.getByRole('img', { name: 'Фото 1 из 3' }), { key: 'ArrowLeft' });
  expect(screen.getByRole('img', { name: 'Фото 3 из 3' })).toBeVisible();
});

it('одно фото без стрелок, записи без фото ничего не добавляют', () => {
  const { container } = renderApp(<PostPhotos ids={[]} />);
  expect(container.textContent).toBe('');
  renderApp(<PostPhotos ids={['f1']} />);
  fireEvent.click(screen.getByRole('button', { name: 'Открыть фото 1 из 1' }));
  expect(screen.queryByRole('button', { name: /Дальше/ })).toBeNull();
});

it('фото выбираются, убираются и уходят уменьшенными одним запросом', async () => {
  const posted = vi.fn();
  api.mockResolvedValue({ id: 'p1' } as never);
  renderApp(<PostForm postTo={PATH} onPosted={posted} />);
  pick([image('a.jpg'), image('b.jpg'), new File(['%PDF'], 'c.pdf', { type: 'application/pdf' })]);
  expect(screen.getAllByRole('img').map((i) => i.getAttribute('alt'))).toEqual(['Фото 1', 'Фото 2']);
  fireEvent.click(screen.getByRole('button', { name: 'Убрать фото 1' }));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-1');
  expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeEnabled();

  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' })));
  expect(prepareImage).toHaveBeenCalledWith(expect.objectContaining({ name: 'b.jpg' }), 2048);
  const [method, path, body] = api.mock.calls[0];
  expect([method, path]).toEqual(['POST', PATH]);
  const data = body as FormData;
  expect(data.get('text')).toBe('');
  expect(data.getAll('photo')).toHaveLength(1);
  expect(data.get('photo')).toMatchObject({ name: 'photo-1.jpg', size: new Blob(['мал-b.jpg']).size });
  expect(posted).toHaveBeenCalled();
  expect(screen.queryByRole('img')).toBeNull();
});

it('без фото запись уходит как раньше, JSON', async () => {
  api.mockResolvedValue({ id: 'p1' } as never);
  renderApp(<PostForm postTo={PATH} onPosted={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Объявление для учеников и родителей'), { target: { value: 'Привет' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' })));
  expect(api).toHaveBeenCalledWith('POST', PATH, { text: 'Привет', publishAt: undefined });
});

it('больше 10 фото не добавить', () => {
  renderApp(<PostForm postTo={PATH} onPosted={vi.fn()} />);
  pick(Array.from({ length: 12 }, (_, i) => image(`${i}.jpg`)));
  expect(screen.getAllByRole('img')).toHaveLength(10);
  expect(screen.getByText('В записи может быть не больше 10 фото')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Ещё фото' })).toBeDisabled();
});

it('ошибка сервера оставляет фото и текст в форме', async () => {
  api.mockRejectedValue(new Error('Место для файлов группы закончилось'));
  renderApp(<PostForm postTo={PATH} onPosted={vi.fn()} />);
  pick([image('a.jpg')]);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' })));
  expect(await screen.findByText('Место для файлов группы закончилось')).toBeVisible();
  expect(screen.getAllByRole('img')).toHaveLength(1);
});

it('лента группы напоминает, чьи фото нельзя публиковать, только когда фото выбраны', async () => {
  api.mockResolvedValue([] as never);
  renderInGroup(<GroupFeed />, groupData());
  await screen.findByText('Пока без объявлений');
  expect(screen.queryByText(/нельзя публиковать фото/)).toBeNull();
  pick([image('a.jpg')]);
  expect(screen.getByText('Проверьте снимки: нельзя публиковать фото Петя Смирнов.')).toBeVisible();
});

it('отметка «не публиковать фото» сохраняется вместе с именем', async () => {
  const saved = vi.fn();
  api.mockResolvedValue({} as never);
  const student = groupData().students[0] as LessonStudent;
  renderApp(<RenameModal student={student} onClose={vi.fn()} onSaved={saved} />);
  fireEvent.click(screen.getByRole('checkbox', { name: /Не публиковать фото/ }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Сохранить' })));
  expect(api).toHaveBeenCalledWith('PATCH', `/teacher/students/${student.id}`, { name: student.name, noPhotos: true });
  expect(saved).toHaveBeenCalled();
});

