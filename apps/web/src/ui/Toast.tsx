import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { exitDelay } from '../lib/presence';

interface ToastItem {
  id: number;
  text: ReactNode;
  action?: { label: string; run: () => void };
  tone: 'ok' | 'error' | 'neutral';
  leaving?: boolean;
}

const ToastContext = createContext<(t: Omit<ToastItem, 'id' | 'leaving'>) => void>(() => undefined);

const toneClass = {
  ok: 'bg-ink text-bg',
  neutral: 'bg-ink text-bg',
  error: 'bg-minus text-white',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  // Сначала анимация ухода, затем удаление из списка
  const remove = (id: number) => {
    setItems((list) => list.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), exitDelay(180));
  };
  const push = useCallback((t: Omit<ToastItem, 'id' | 'leaving'>) => {
    const id = nextId.current++;
    setItems((list) => [...list.slice(-2), { ...t, id }]);
    setTimeout(() => remove(id), t.action ? 6000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`flex max-w-md items-center gap-4 rounded-full py-2.5 pl-5 pr-2.5 text-[15px] font-medium shadow-[var(--shadow-pop)] ${toneClass[t.tone]} ${
              t.leaving ? 'anim-toast-out' : 'pointer-events-auto anim-toast-in'
            }`}
          >
            <span>{t.text}</span>
            {t.action ? (
              <button
                className="rounded-full bg-accent px-3 py-1.5 text-sm font-bold text-on-accent"
                onClick={() => {
                  t.action!.run();
                  remove(t.id);
                }}
              >
                {t.action.label}
              </button>
            ) : (
              <span className="w-2" />
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
