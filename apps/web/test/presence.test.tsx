import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '../src/components/ui';
import { presenceConfig } from '../src/lib/presence';

describe('анимация ухода окна', () => {
  beforeEach(() => {
    presenceConfig.skipExit = false;
    vi.useFakeTimers();
  });
  afterEach(() => {
    presenceConfig.skipExit = true;
    vi.useRealTimers();
  });

  it('окно ещё видно с анимацией ухода, затем убирается из DOM', () => {
    const { rerender } = render(
      <Modal open title="Окно" onClose={() => undefined}>
        текст
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toHaveClass('anim-sheet-in');

    rerender(
      <Modal open={false} title="Окно" onClose={() => undefined}>
        текст
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toHaveClass('anim-sheet-out');

    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('повторное открытие во время ухода оставляет окно открытым', () => {
    const view = (open: boolean) => (
      <Modal open={open} title="Окно" onClose={() => undefined}>
        текст
      </Modal>
    );
    const { rerender } = render(view(true));
    rerender(view(false));
    rerender(view(true));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole('dialog')).toHaveClass('anim-sheet-in');
  });
});
