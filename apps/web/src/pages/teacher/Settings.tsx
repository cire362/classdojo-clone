import { useState, type FormEvent } from 'react';
import { SparkleIcon, UserIcon } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { useAuth } from '../../features/auth';
import { PasswordCard } from '../../components/PasswordCard';
import { useToast } from '../../ui/Toast';
import { Skeleton } from '../../ui';
import { useLoad } from '../../lib/hooks';

export function SettingsPage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      await api('PATCH', '/teacher/me', { name });
      await refresh();
      toast({ text: 'Имя сохранено', tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl">Настройки</h1>
        <p className="mt-2 text-ink-soft">Логин: <span className="font-mono">{user?.login}</span></p>
      </div>

      <form onSubmit={saveName} className="card space-y-4 p-5" noValidate>
        <h2 className="flex items-center gap-2 text-lg">
          <UserIcon size={22} /> Имя
        </h2>
        <div>
          <label className="label" htmlFor="teacher-name">
            Как к вам обращаться
          </label>
          <input id="teacher-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          <p className="mt-2 text-sm text-ink-soft">Имя видно в шапке и в приветствии.</p>
        </div>
        <button className="btn btn-primary" disabled={savingName || !name.trim() || name.trim() === user?.name}>
          {savingName ? 'Сохраняем…' : 'Сохранить имя'}
        </button>
      </form>

      <PasswordCard endpoint="/teacher/me/password" />

      <PremiumCard />
    </div>
  );
}

/** Премиум: пока без оплаты на сайте — подключает администратор */
function PremiumCard() {
  const { data } = useLoad(() => api<{ active: boolean; until: string | null; freeForAll: boolean }>('GET', '/teacher/plan'), []);
  return (
    <section className="card space-y-4 p-5" aria-labelledby="premium-title">
      <h2 id="premium-title" className="flex items-center gap-2 text-lg">
        <SparkleIcon size={22} weight="fill" /> Премиум
      </h2>
      {!data ? (
        <Skeleton className="h-16" />
      ) : data.freeForAll ? (
        <p>Сейчас премиум бесплатен для всех: ученикам ваших групп открыты все тематические коллекции героев. Детали доступны по уровню.</p>
      ) : data.active ? (
        <p>
          Подключён до <b>{new Date(data.until!).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</b>. Ученикам ваших
          групп открыты все тематические коллекции героев. Детали доступны по уровню.
        </p>
      ) : (
        <p>
          {data.until ? 'Срок премиума закончился.' : 'Сейчас у вас бесплатный тариф: все функции для уроков работают без ограничений.'}
        </p>
      )}
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
        <li>Тематические коллекции деталей героя: «Космос», «Весна», «Лето», «Осень» и «Зима».</li>
        <li>Действует для учеников групп, которые вы создали; детали открываются по уровню, как обычные.</li>
      </ul>
      {data && !data.active && <p className="text-sm text-ink-soft">Оплата на сайте появится позже. Чтобы подключить премиум сейчас, обратитесь к администратору.</p>}
    </section>
  );
}
