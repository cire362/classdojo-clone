import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { GroupFeed } from '../src/features/feed/components/GroupFeed';
import { PostForm } from '../src/features/feed/components/PostForm';
import { PostMedia } from '../src/features/feed/components/PostMedia';
import { RenameModal } from '../src/features/students/components/RenameModal';
import type { LessonStudent } from '../src/lib/api';
import { groupData, renderInGroup } from './group-harness';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
vi.mock('../src/lib/photo', () => ({ prepareImage: vi.fn(async (file: File) => new Blob([`мал-${file.name}`], { type: 'image/jpeg' })) }));
vi.mock('../src/lib/video', () => ({ videoPoster: vi.fn(async () => new Blob(['обложка'], { type: 'image/jpeg' })) }));
const api = vi.mocked((await import('../src/lib/api')).api);
const { prepareImage } = vi.mocked(await import('../src/lib/photo'));
const { videoPoster } = vi.mocked(await import('../src/lib/video'));
const PATH = '/teacher/groups/g1/feed';

let urls = 0;
beforeEach(() => {
  api.mockReset();
  prepareImage.mockClear();
  videoPoster.mockClear();
  urls = 0;
  URL.createObjectURL = vi.fn(() => `blob:photo-${++urls}`);
  URL.revokeObjectURL = vi.fn();
});

const image = (name: string) => new File(['x'], name, { type: 'image/jpeg' });
const video = (name: string, size = 10) => new File(['x'.repeat(size)], name, { type: 'video/mp4' });
const photos = (...ids: string[]) => ids.map((id) => ({ id, kind: 'photo' as const }));
const pick = (files: File[]) => fireEvent.change(document.querySelector('input[type=file]')!, { target: { files } });

it('сетка превью открывает снимок целиком, стрелки листают по кругу', async () => {
  renderApp(<PostMedia media={photos('f1', 'f2', 'f3')} />);
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
  const { container } = renderApp(<PostMedia media={[]} />);
  expect(container.textContent).toBe('');
  renderApp(<PostMedia media={photos('f1')} />);
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
  expect(screen.getByText('В записи может быть не больше 10 фото и видео')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Ещё фото или видео' })).toBeDisabled();
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
  expect(screen.getByText('Проверьте снимки и видео. Нельзя публиковать: Петя Смирнов.')).toBeVisible();
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


it('видео идёт с обложкой из браузера, фото рядом с ним уменьшаются', async () => {
  api.mockResolvedValue({ id: 'p1' } as never);
  renderApp(<PostForm postTo={PATH} onPosted={vi.fn()} />);
  pick([video('урок.mp4'), image('a.jpg')]);
  expect(screen.getByRole('img', { name: 'Видео: урок.mp4' })).toBeVisible();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' })));
  expect(videoPoster).toHaveBeenCalledWith(expect.objectContaining({ name: 'урок.mp4' }));
  const data = api.mock.calls[0][2] as FormData;
  expect(data.get('video')).toMatchObject({ name: 'урок.mp4' });
  expect(data.get('poster')).toMatchObject({ name: 'poster.jpg' });
  expect(data.getAll('photo')).toHaveLength(1);
});

it('без обложки видео всё равно уходит', async () => {
  videoPoster.mockResolvedValueOnce(null);
  api.mockResolvedValue({ id: 'p1' } as never);
  renderApp(<PostForm postTo={PATH} onPosted={vi.fn()} />);
  pick([video('hevc.mov')]);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' })));
  const data = api.mock.calls[0][2] as FormData;
  expect(data.get('video')).toMatchObject({ name: 'hevc.mov' });
  expect(data.get('poster')).toBeNull();
});

it('второе видео и слишком большое видео не добавляются', () => {
  renderApp(<PostForm postTo={PATH} onPosted={vi.fn()} />);
  pick([video('первое.mp4'), video('второе.mp4')]);
  expect(screen.getByText('В записи может быть одно видео')).toBeVisible();
  expect(screen.getAllByRole('img', { name: /^Видео/ })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Убрать видео' }));
  const big = video('длинное.mov');
  Object.defineProperty(big, 'size', { value: 101 * 1024 * 1024 });
  pick([big]);
  expect(screen.getByText('Видео больше 100 МБ: обрежьте его или снимите покороче')).toBeVisible();
  expect(screen.queryByRole('img', { name: /^Видео/ })).toBeNull();
});

it('в записи видео с обложкой и элементами управления, фото отдельной сеткой', () => {
  const { container } = renderApp(<PostMedia media={[{ id: 'v1', kind: 'video' }, ...photos('f1')]} />);
  const player = container.querySelector('video')!;
  expect(player).toHaveAttribute('src', '/api/files/v1');
  expect(player).toHaveAttribute('poster', '/api/files/v1?size=preview');
  expect(player).toHaveAttribute('controls');
  expect(player).toHaveAttribute('preload', 'none');
  expect(screen.getByRole('button', { name: 'Открыть фото 1 из 1' })).toBeVisible();
});
