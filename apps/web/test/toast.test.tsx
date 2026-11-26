import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../src/ui/Toast';

function Trigger() {
  const toast = useToast();
  return <button onClick={() => toast({ text: 'Сохранено', tone: 'ok' })}>Показать уведомление</button>;
}

it('пустая область уведомлений не занимает место, а при показе и уходе сохраняет live region', () => {
  vi.useFakeTimers();
  try {
    const { container } = render(<ToastProvider><Trigger /></ToastProvider>);
    const region = container.querySelector('[aria-live="polite"]')!;
    expect(region).toHaveClass('sr-only', 'left-0', 'top-0');
    expect(region).not.toHaveClass('fixed');

    fireEvent.click(screen.getByRole('button', { name: 'Показать уведомление' }));
    expect(region).toHaveClass('fixed', 'inset-0');
    expect(region).toHaveTextContent('Сохранено');

    act(() => vi.advanceTimersByTime(4000));
    expect(region).toBeEmptyDOMElement();
    expect(region).not.toHaveClass('fixed');
    expect(region).toHaveClass('sr-only');
  } finally {
    vi.useRealTimers();
  }
});
