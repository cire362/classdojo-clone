import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/features/auth';
import { ClassCodePanel } from '../src/features/codes/components/ClassCodePanel';
import { IssueCardsButton } from '../src/features/codes/components/IssueCardsButton';
import { JoinClass } from '../src/features/codes/components/JoinClass';
import { LoginCardsSheet } from '../src/features/codes/components/LoginCardsSheet';
import { QrImage } from '../src/features/codes/components/QrImage';
import { QrLogin } from '../src/features/codes/components/QrLogin';
import { DEFAULT_HERO } from '@heroes/shared';
import { renderApp } from './render';

vi.mock('../src/lib/api', async (orig) => ({ ...(await orig<typeof import('../src/lib/api')>()), api: vi.fn() }));
const api = vi.mocked((await import('../src/lib/api')).api);
const USER = { login: 'masha.i', role: 'STUDENT', name: 'Маша Иванова' };
const CODE = { code: 'ABC234', expiresAt: new Date(Date.now() + 40 * 60_000).toISOString() };
const ROSTER = { groupName: '5 «А»', students: [{ id: 's1', name: 'Маша И.', hero: { name: '', parts: DEFAULT_HERO } }] };

function reply(routes: Record<string, unknown>) {
  api.mockImplementation(async (_method, path) => {
    if (path === '/auth/me') return { user: null } as never;
    if (!(path in routes)) throw new Error(`нет ответа для ${path}`);
    const value = routes[path];
    if (value instanceof Error) throw value;
    return value as never;
  });
}
function renderAt(ui: React.ReactElement, route: string) {
  window.history.replaceState(null, '', route);
  return renderApp(
    <AuthProvider>
      <Routes>
        <Route path="/" element={<p>Кабинет</p>} />
        <Route path="*" element={ui} />
      </Routes>
    </AuthProvider>,
    { route: route.split('#')[0] },
  );
}

beforeEach(() => { api.mockReset(); window.history.replaceState(null, '', '/'); });

it('QR: рисунок строится, в подписи есть назначение', async () => {
  renderApp(<QrImage value="https://example.org/q#token" label="QR-код для входа" className="w-32" />);
  const image = await screen.findByRole('img', { name: 'QR-код для входа' });
  expect(image.querySelector('path')?.getAttribute('d')).toContain('M');
  expect(image).toHaveClass('bg-white');
});

it('вход по карточке: токен уходит на сервер и сразу убирается из адреса', async () => {
  reply({ '/auth/qr': { user: USER } });
  renderAt(<QrLogin />, '/q#secret-token');
  expect(await screen.findByText('Кабинет')).toBeVisible();
  expect(api).toHaveBeenCalledWith('POST', '/auth/qr', { token: 'secret-token' });
  expect(api.mock.calls.filter(([, path]) => path === '/auth/qr')).toHaveLength(1);
  expect(window.location.hash).toBe('');
  expect(localStorage.getItem('heroes:role')).toBe('STUDENT');
});

it('устаревшая карточка объясняет, что делать, и ведёт ко входу по логину', async () => {
  reply({ '/auth/qr': new Error('Код не подошёл. Попроси учителя показать его ещё раз') });
  renderAt(<QrLogin />, '/q#old');
  expect(await screen.findByRole('alert')).toHaveTextContent('Код не подошёл');
  expect(screen.getByRole('link', { name: 'Войти по логину' })).toBeVisible();
});

it('ссылка без кода не обращается к серверу', async () => {
  reply({});
  renderAt(<QrLogin />, '/q');
  expect(await screen.findByRole('alert')).toHaveTextContent('В ссылке нет кода');
  expect(api.mock.calls.some(([, path]) => path === '/auth/qr')).toBe(false);
});

it('код класса: ввод, выбор имени, вход', async () => {
  reply({ '/auth/class-code': ROSTER, '/auth/class-code/login': { user: USER } });
  renderAt(<JoinClass />, '/join');
  expect(screen.getByRole('button', { name: 'Дальше' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Код'), { target: { value: 'abc234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
  fireEvent.click(await screen.findByRole('button', { name: /Маша И\./ }));
  expect(await screen.findByText('Кабинет')).toBeVisible();
  expect(api).toHaveBeenCalledWith('POST', '/auth/class-code/login', { code: 'abc234', studentId: 's1' });
});

it('код из QR проверяется сам и убирается из адреса', async () => {
  reply({ '/auth/class-code': ROSTER });
  renderAt(<JoinClass />, '/join#ABC234');
  expect(await screen.findByRole('heading', { name: 'Кто ты?' })).toBeVisible();
  expect(window.location.hash).toBe('');
});

it('неверный код остаётся в поле с понятной ошибкой', async () => {
  reply({ '/auth/class-code': new Error('Код не подошёл. Попроси учителя показать его ещё раз') });
  renderAt(<JoinClass />, '/join');
  fireEvent.change(screen.getByLabelText('Код'), { target: { value: 'WRONG2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Код не подошёл');
  expect(screen.getByLabelText('Код')).toHaveValue('WRONG2');
});

it('панель включает код, показывает его и отключает', async () => {
  const path = '/teacher/groups/g1/class-code';
  api.mockImplementation(async (method) => (method === 'GET' ? null : method === 'POST' ? CODE : { ok: true }) as never);
  renderApp(<ClassCodePanel groupId="g1" projector={false} target={null} />);
  expect(api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Код класса' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Включить код класса' }));
  expect(await screen.findByText('ABC234')).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Работает до');
  expect(await screen.findByRole('img', { name: /код ABC234/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Отключить' }));
  expect(await screen.findByRole('button', { name: 'Включить код класса' })).toBeVisible();
  expect(api).toHaveBeenCalledWith('DELETE', path);
});

it('истёкший код сам исчезает с экрана', async () => {
  vi.useFakeTimers();
  api.mockResolvedValue({ code: 'ABC234', expiresAt: new Date(Date.now() + 5000).toISOString() } as never);
  renderApp(<ClassCodePanel groupId="g1" projector={false} target={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Код класса' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(screen.getByText('ABC234')).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
  expect(screen.queryByText('ABC234')).not.toBeInTheDocument();
  vi.useRealTimers();
});

it('выпуск спрашивает подтверждение и передаёт карточки на лист печати', async () => {
  api.mockResolvedValue({ cards: [] } as never);
  renderApp(<IssueCardsButton groupId="g1" className="btn" />);
  fireEvent.click(screen.getByRole('button', { name: 'QR-карточки' }));
  expect(api).not.toHaveBeenCalled();
  expect(screen.getByText(/Выданные раньше карточки всей группы перестанут работать/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Выпустить' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('POST', '/teacher/groups/g1/login-cards', { studentIds: undefined }));
});

it('лист печати показывает имя, QR и срок', async () => {
  const card = { studentId: 's1', name: 'Маша Иванова', token: 't', expiresAt: '2027-02-01T10:00:00.000Z' };
  renderApp(<LoginCardsSheet cards={[card]} />);
  expect(screen.getByText('Маша Иванова')).toBeVisible();
  expect(screen.getByText(/Действует до 01\.02\.2027/)).toBeVisible();
  expect(await screen.findByRole('img', { name: 'QR-код для входа: Маша Иванова' })).toBeInTheDocument();
});
