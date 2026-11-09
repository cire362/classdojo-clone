import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { iconKey } from '@heroes/shared/icons';
import { Glyph } from '../src/ui/Glyph';
import { IconPicker } from '../src/ui/IconPicker';

it('значок — рисованная иконка: ключ, старое эмодзи и незнакомое значение', () => {
  expect(iconKey('handshake')).toBe('handshake');
  expect(iconKey('🤝')).toBe('handshake');
  expect(iconKey('🧹')).toBe('sparkle');
  const { container } = render(<><Glyph name="🤝" /><Glyph name="chair" /><Glyph name="🧹" /></>);
  expect(container.querySelectorAll('svg')).toHaveLength(3);
  expect(container.textContent).toBe('');
});

it('выбор значка отдаёт ключ и отмечает выбранный, старое эмодзи понимает как его ключ', () => {
  const onChange = vi.fn();
  render(<IconPicker options={['star', 'gift', 'chair']} value="🎁" onChange={onChange} />);
  expect(screen.getByRole('button', { name: 'Значок: подарок' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Значок: стул' }));
  expect(onChange).toHaveBeenCalledWith('chair');
});
