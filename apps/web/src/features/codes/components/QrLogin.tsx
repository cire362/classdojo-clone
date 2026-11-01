import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth';
import { Skeleton } from '../../../ui';
import { loginByCard } from '../api';

/** Токен лежит во фрагменте адреса: он не попадает на сервер в логи и в заголовок Referer */
export function QrLogin() {
  const { signedIn } = useAuth();
  const navigate = useNavigate();
  const token = useRef(window.location.hash.slice(1));
  const started = useRef(false);
  const [error, setError] = useState(token.current ? '' : 'В ссылке нет кода. Наведи камеру на карточку ещё раз');

  useEffect(() => {
    if (started.current || !token.current) return;
    started.current = true;
    window.history.replaceState(window.history.state, '', window.location.pathname);
    loginByCard(token.current)
      .then(({ user }) => {
        signedIn(user);
        navigate('/', { replace: true });
      })
      .catch((e: Error) => setError(e.message));
  }, [navigate, signedIn]);

  return (
    <main className="mx-auto max-w-sm space-y-4 px-4 py-16">
      <h1 className="text-3xl">Вход по карточке</h1>
      {error ? (
        <>
          <p role="alert" className="font-medium text-minus">{error}</p>
          <Link to="/login" className="btn btn-secondary">Войти по логину</Link>
        </>
      ) : (
        <div role="status" className="space-y-3">
          <p className="text-ink-soft">Входим…</p>
          <Skeleton className="h-12" />
        </div>
      )}
    </main>
  );
}
