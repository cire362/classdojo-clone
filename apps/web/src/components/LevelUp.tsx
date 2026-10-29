import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { LEVELS, type HeroParts } from '@heroes/shared';
import { pluralize } from '../hooks';
import { HeroAvatar } from './HeroAvatar';
import { PartPreview } from './PartPreview';

const CONFETTI_COLORS = ['#ffc233', '#2f6fde', '#e63946', '#2a9d55', '#7b4fd6', '#ec5f9e', '#14a3a3'];

/** Конфетти из простых прямоугольников; при «уменьшении движения» не показывается */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.6,
        drift: (Math.random() - 0.5) * 160,
        rotate: (Math.random() - 0.5) * 900,
        w: 6 + Math.random() * 6,
        h: 10 + Math.random() * 10,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 block rounded-[2px]"
          style={{ left: `${p.left}%`, width: p.w, height: p.h, background: p.color }}
          initial={{ y: '-5vh', x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '105vh', x: p.drift, rotate: p.rotate, opacity: [1, 1, 0.8] }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.25, 0.6, 0.5, 1] }}
        />
      ))}
    </div>
  );
}

export function LevelUpOverlay({
  open,
  level,
  hero,
  newPartIds,
  onClose,
}: {
  open: boolean;
  level: number;
  hero: HeroParts;
  newPartIds: string[];
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const closeRef = useRef<HTMLButtonElement>(null);
  const title = LEVELS[level - 1]?.title ?? '';
  const shown = newPartIds.slice(0, 6);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgb(14_17_34/0.72)] p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Новый уровень: ${level}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {!reduce && <Confetti />}
            <motion.div
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-surface text-center shadow-[var(--shadow-pop)]"
              initial={{ scale: 0.85, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
              <div className="relative bg-accent/30 px-6 pt-10">
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-25"
                  style={{ backgroundImage: 'radial-gradient(var(--ink) 1px, transparent 1px)', backgroundSize: '16px 16px' }}
                />
                <motion.div
                  className="relative mx-auto w-44"
                  initial={reduce ? false : { y: 30, scale: 0.9 }}
                  animate={{ y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.15 }}
                >
                  <HeroAvatar parts={hero} className="aspect-[5/6]" />
                </motion.div>
                <motion.span
                  className="absolute right-6 top-6 flex size-16 items-center justify-center rounded-full bg-accent font-display text-3xl text-on-accent shadow-[var(--shadow-pop)]"
                  initial={reduce ? false : { scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.35 }}
                >
                  {level}
                </motion.span>
              </div>

              <div className="space-y-5 px-6 pb-6 pt-5">
                <div>
                  <h2 className="text-2xl leading-tight sm:text-3xl">Новый уровень!</h2>
                  <p className="mt-1 text-lg text-ink-soft">
                    Теперь ты <b className="text-ink">{title}</b>
                  </p>
                </div>

                {shown.length > 0 && (
                  <div className="space-y-3 text-left">
                    <p className="font-semibold">
                      {pluralize(newPartIds.length, 'Открылась', 'Открылись', 'Открылось')} {newPartIds.length}{' '}
                      {pluralize(newPartIds.length, 'новая деталь', 'новые детали', 'новых деталей')}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {shown.map((id) => (
                        <PartPreview key={id} partId={id} base={hero} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row-reverse">
                  {newPartIds.length > 0 && (
                    <button
                      className="btn btn-primary btn-lg flex-1"
                      onClick={() => {
                        onClose();
                        navigate('/hero');
                      }}
                    >
                      Примерить
                    </button>
                  )}
                  <button ref={closeRef} className={`btn btn-lg flex-1 ${newPartIds.length ? 'btn-secondary' : 'btn-primary'}`} onClick={onClose}>
                    Ура!
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
