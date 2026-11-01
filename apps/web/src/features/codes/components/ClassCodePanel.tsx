import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QrCodeIcon, XIcon } from '@phosphor-icons/react';
import type { ClassCode } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { createClassCode, fetchClassCode, removeClassCode } from '../api';
import { QrImage } from './QrImage';

const clock = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

function CodeBody({ groupId, projector }: { groupId: string; projector: boolean }) {
  const toast = useToast();
  const { data: code, setData, error, loading, reload } = useLoad(() => fetchClassCode(groupId), [groupId]);
  const [busy, setBusy] = useState(false);
  const site = window.location.host;

  // Истёкший код не должен оставаться на проекторе
  useEffect(() => {
    if (!code) return;
    const timer = window.setTimeout(() => setData(null), new Date(code.expiresAt).getTime() - Date.now());
    return () => window.clearTimeout(timer);
  }, [code, setData]);

  async function run(request: () => Promise<ClassCode | null>) {
    if (busy) return;
    setBusy(true);
    try {
      setData(await request());
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }
  const open = () => run(() => createClassCode(groupId));
  const close = () => run(async () => { await removeClassCode(groupId); return null; });

  if (error) return <div className="mt-4"><ErrorBox message={error} onRetry={reload} /></div>;
  if (loading && !code) return <Skeleton className="mt-4 h-24" />;
  if (!code) {
    return (
      <div className="mt-4 space-y-3">
        <p className="text-sm text-ink-soft">
          Ученики открывают ссылку или наводят камеру на QR-код и выбирают своё имя. Код работает 45 минут, отключить его можно раньше.
        </p>
        <button className="btn btn-primary" disabled={busy} onClick={open}>Включить код класса</button>
      </div>
    );
  }
  return (
    <div className={`mt-4 flex flex-wrap items-center gap-6 ${projector ? 'justify-center text-center' : ''}`}>
      <QrImage
        value={`${window.location.origin}/join#${code.code}`}
        label={`QR-код для входа в класс, код ${code.code}`}
        className={`rounded-xl ${projector ? 'w-72' : 'w-44'}`}
      />
      <div className="min-w-0 space-y-3">
        <p className="text-sm text-ink-soft">Откройте {site}/join и введите код</p>
        <p className={`font-mono font-semibold tracking-[0.15em] ${projector ? 'text-6xl' : 'text-4xl'}`}>{code.code}</p>
        <p role="status" className="text-sm font-semibold">Работает до {clock(code.expiresAt)}</p>
        <div className={`flex flex-wrap gap-2 ${projector ? 'justify-center' : ''}`}>
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={open}>Новый код</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={close}>Отключить</button>
        </div>
        {!projector && (
          <p className="max-w-md text-sm text-ink-soft">
            Пока код работает, войти под любым именем из группы может каждый, кто его знает. Показывайте его только в классе.
          </p>
        )}
      </div>
    </div>
  );
}

/** Общий код на уроке: как и остальные инструменты, в проекторе панель переносится на экран */
export function ClassCodePanel({ groupId, projector, target }: { groupId: string; projector: boolean; target: HTMLElement | null }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const focusToggle = useRef(false);

  useEffect(() => {
    if (!open && focusToggle.current) { toggle.current?.focus(); focusToggle.current = false; }
  }, [open]);

  const panel = (
    <section aria-label="Код класса" className={projector ? 'mb-6' : open ? 'w-full' : ''}>
      {!open ? (
        <button ref={toggle} className="btn btn-secondary btn-sm" aria-expanded={false} onClick={() => setOpen(true)}>
          <QrCodeIcon size={20} aria-hidden /> Код класса
        </button>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
              <QrCodeIcon size={22} aria-hidden /> Код класса
            </h2>
            <button
              className="icon-btn -mr-2 -mt-2"
              aria-label="Скрыть код класса"
              onClick={() => {
                focusToggle.current = true;
                setOpen(false);
              }}
            >
              <XIcon size={20} aria-hidden />
            </button>
          </div>
          <CodeBody groupId={groupId} projector={projector} />
        </div>
      )}
    </section>
  );

  if (projector) return target ? createPortal(panel, target) : null;
  return panel;
}
