import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/features/auth';
import { AcceptInvite } from '../src/features/parents/components/AcceptInvite';
import { InviteModal } from '../src/features/students/components/InviteModal';
import { ParentAccessCard } from '../src/features/students/components/ParentAccess';
import { ParentInvitesSheet } from '../src/features/students/components/ParentInvitesSheet';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
const PREVIEW = { studentName: 'Маша Иванова', groupName: '5 «А»' };
const PARENT = { login: 'parent.masha.i', role: 'PARENT', name: 'Родитель: Маша Иванова' };
const INVITE = { id: 'i1', studentId: 's1', studentName: 'Маша Иванова', code: 'ABCDEFGH23', expiresAt: '2026-11-20T10:00:00.000Z' };

function reply(routes: Record<string, unknown>, me: unknown = null) {
  api.mockImplementation(async (_method, path) => {
    if (path === '/auth/me') return { user: me } as never;
    if (!(path in routes)) throw new Error(`нет ответа для ${path}`);
    const value = routes[path];
    if (value instanceof Error) throw value;
    return value as never;
  });
}
function renderAt(route: string) {
  window.history.replaceState(null, '', route);
  return renderApp(
    <AuthProvider>
      <Routes>
        <Route path="/" element={<p>Кабинет</p>} />
        <Route path="/login" element={<p>Страница входа</p>} />
        <Route path="*" element={<AcceptInvite />} />
      </Routes>
    </AuthProvider>,
    { route: route.split('#')[0] },
  );
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => { api.mockReset(); window.history.replaceState(null, '', '/'); });

it('код из ссылки проверяется сам; родитель задаёт пароль и видит свой логин', async () => {
  reply({ '/auth/invite': PREVIEW, '/auth/invite/accept': { user: PARENT, login: 'parent.masha.i' } });
  renderAt('/invite#ABCDEFGH23');
  expect(await screen.findByRole('heading', { name: 'Вход для родителей' })).toBeVisible();
  expect(window.location.hash).toBe('');
  expect(screen.getByRole('button', { name: 'Создать вход' })).toBeDisabled();
  type('Пароль', 'мой-пароль');
  type('Пароль ещё раз', 'другой');
  expect(screen.getByText('Пароли не совпадают.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Создать вход' })).toBeDisabled();
  type('Пароль ещё раз', 'мой-пароль');
  click('Создать вход');
  expect(await screen.findByText('parent.masha.i')).toBeVisible();
  expect(api).toHaveBeenCalledWith('POST', '/auth/invite/accept', { code: 'ABCDEFGH23', password: 'мой-пароль' });
  click('В кабинет');
  expect(await screen.findByText('Кабинет')).toBeVisible();
});

it('код с листа вводится вручную, неверный остаётся в поле', async () => {
  reply({ '/auth/invite': new Error('Приглашение не подошло или устарело') });
  renderAt('/invite');
  type('Код приглашения', 'ABCDE-FGH22');
  click('Дальше');
  expect(await screen.findByRole('alert')).toHaveTextContent('Приглашение не подошло');
  expect(screen.getByLabelText('Код приглашения')).toHaveValue('ABCDE-FGH22');
});

it('вошедшему родителю предлагается добавить ребёнка, а не новый вход', async () => {
  reply({ '/auth/invite': PREVIEW, '/parent/invite': PREVIEW }, PARENT);
  renderAt('/invite#ABCDEFGH23');
  fireEvent.click(await screen.findByRole('button', { name: 'Добавить ребёнка' }));
  expect(await screen.findByText('Кабинет')).toBeVisible();
  expect(api).toHaveBeenCalledWith('POST', '/parent/invite', { code: 'ABCDEFGH23' });
});

it('родитель с готовым входом уходит на вход и возвращается к приглашению', async () => {
  reply({ '/auth/invite': PREVIEW });
  renderAt('/invite#ABCDEFGH23');
  fireEvent.click(await screen.findByRole('button', { name: 'У меня уже есть вход' }));
  expect(await screen.findByText('Страница входа')).toBeVisible();
});

it('преподаватель создаёт приглашение и отзывает действующее', async () => {
  let active = [{ id: 'i1', expiresAt: INVITE.expiresAt }];
  api.mockImplementation(async (method, path) => {
    if (path.endsWith('/parent-invites') && method === 'GET') return active as never;
    if (path.endsWith('/parent-invites')) return INVITE as never;
    if (method === 'DELETE') { active = []; return { ok: true } as never; }
    return [] as never;
  });
  renderApp(<ParentAccessCard student={{ id: 's1', name: 'Маша Иванова' }} groupId="g1" archived={false} />);
  expect(await screen.findByRole('list', { name: 'Действующие приглашения' })).toBeVisible();
  click('Пригласить');
  expect(await screen.findByText('ABCDE-FGH23')).toBeVisible();
  expect(screen.getByText(/\/invite#ABCDEFGH23$/)).toBeVisible();
  click('Отозвать приглашение');
  expect(await screen.findByText('Приглашение отозвано')).toBeVisible();
});

it('в архивной группе пригласить нельзя', async () => {
  api.mockResolvedValue([] as never);
  renderApp(<ParentAccessCard student={{ id: 's1', name: 'Маша Иванова' }} groupId="g1" archived />);
  expect(await screen.findByText(/Вход для родителей ещё не выдан/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Пригласить' })).not.toBeInTheDocument();
});

it('ссылка копируется в буфер', async () => {
  renderApp(<InviteModal invite={INVITE} groupId="g1" onClose={() => undefined} />);
  click('Скопировать ссылку');
  expect(await screen.findByText('Ссылка скопирована')).toBeVisible();
  expect(await navigator.clipboard.readText()).toMatch(/\/invite#ABCDEFGH23$/);
});

it('лист показывает ребёнка, код и срок; пустой список объясняется', async () => {
  const view = renderApp(<ParentInvitesSheet invites={[INVITE]} />);
  expect(screen.getByText('Маша Иванова')).toBeVisible();
  expect(screen.getByText('ABCDE-FGH23')).toBeVisible();
  expect(await screen.findByRole('img', { name: 'QR-код приглашения: Маша Иванова' })).toBeInTheDocument();
  view.unmount();
  renderApp(<ParentInvitesSheet invites={[]} />);
  expect(screen.getByText('У всех учеников группы уже есть вход для родителей.')).toBeVisible();
});
