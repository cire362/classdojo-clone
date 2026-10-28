import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface ToastItem {
  id: number;
  text: ReactNode;
  action?: { label: string; run: () => void };
  tone: 'ok' | 'error' | 'neutral';
}

const ToastContext = createContext<(t: Omit<ToastItem, 'id'>) => void>(() => undefined);

const toneClass = {
  ok: 'bg-ink text-bg',
  neutral: 'bg-ink text-bg',
  error: 'bg-minus text-white',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const remove = (id: number) => setItems((list) => list.filter((x) => x.id !== id));
  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
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
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className={`pointer-events-auto flex max-w-md items-center gap-4 rounded-full py-2.5 pl-5 pr-2.5 text-[15px] font-medium shadow-[var(--shadow-pop)] ${toneClass[t.tone]}`}
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
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
