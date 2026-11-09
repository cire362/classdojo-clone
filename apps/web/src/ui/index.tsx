import { useEffect, useId, useRef, type ReactNode } from 'react';
import { WarningIcon, XIcon } from '@phosphor-icons/react';
import { usePresence } from '../lib/presence';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Диалог: на телефоне — шторка снизу, на широком экране — окно по центру */
export function Modal({
  open,
  title,
  onClose,
  children,
  size = 'md',
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { mounted, closing } = usePresence(open, 180);
  // Фокус: при открытии — в окно, Tab не уходит за его пределы, при закрытии — обратно на кнопку,
  // которой окно открыли. Esc закрывает.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const focusable = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      // Не уводим фокус из поля, если пользователь уже начал заполнять окно.
      if (ref.current && !ref.current.contains(document.activeElement)) ref.current.focus();
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open]);

  if (!mounted) return null;
  return (
    <div
      className={`fixed inset-0 z-40 flex items-end justify-center bg-[rgb(14_17_34/0.55)] sm:items-center sm:p-6 ${
        closing ? 'anim-fade-out pointer-events-none' : 'anim-fade-in'
      }`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-surface shadow-[var(--shadow-pop)] outline-none sm:rounded-2xl ${
          size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        } ${closing ? 'anim-sheet-out' : 'anim-sheet-in'}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          <h2 id={titleId} className="text-lg">
            {title}
          </h2>
          <button className="icon-btn -mr-2" onClick={onClose} aria-label="Закрыть">
            <XIcon size={22} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** Скелет сетки карточек — повторяет форму итогового экрана */
export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] sm:gap-4" role="status" aria-label="Загрузка">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="aspect-[4/5]" />
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-minus/30 bg-minus-bg px-4 py-3 text-minus">
      <WarningIcon size={22} weight="bold" className="shrink-0" />
      <span className="flex-1 font-medium">{message}</span>
      {onRetry && (
        <button className="btn btn-sm btn-secondary" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-surface-2/60 px-5 py-5">
      <span className="mt-0.5 shrink-0 text-ink-soft [&>svg]:size-5" aria-hidden>{icon}</span>
      <div className="min-w-0">
        <h3 className="font-sans text-base font-semibold tracking-normal">{title}</h3>
        {children && <div className="mt-1 max-w-[65ch] text-ink-soft">{children}</div>}
      </div>
    </div>
  );
}

export function ProgressBar({ value, label, valueText, className = '' }: { value: number; label: string; valueText?: string; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(v * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText}
      className={`h-3 overflow-hidden rounded-full bg-surface-2 ${className}`}
    >
      <div
        className="anim-grow h-full rounded-full bg-accent transition-[width] duration-700 ease-[var(--ease-out)]"
        style={{ width: `${v * 100}%` }}
      />
    </div>
  );
}

/** Сам переключатель без подписи — для мест, где подписью служит вся строка (внешний <label>) */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <>
      <input type="checkbox" className="peer sr-only" checked={checked} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-surface-2 ring-1 ring-line transition peer-checked:bg-plus peer-focus-visible:ring-4 peer-focus-visible:ring-accent/60 after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-surface after:shadow after:transition-transform after:duration-200 peer-checked:after:translate-x-5"
      />
    </>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-surface-2 ring-1 ring-line transition peer-checked:bg-plus peer-focus-visible:ring-4 peer-focus-visible:ring-accent/60 after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-surface after:shadow after:transition-transform after:duration-200 peer-checked:after:translate-x-5"
      />
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-ink-soft">{hint}</span>}
      </span>
    </label>
  );
}

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-xl sm:text-2xl">{children}</h2>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
