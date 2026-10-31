import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChunkErrorBoundary } from '../src/app/ChunkErrorBoundary';

function Broken(): never {
  throw new Error('Failed to fetch dynamically imported module');
}

describe('заглушка при ошибке загрузки страницы', () => {
  it('вместо пустого экрана показывает сообщение и кнопку «Обновить»', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ChunkErrorBoundary resetKey="/a">
        <Broken />
      </ChunkErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить страницу');
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeInTheDocument();
  });

  it('переход на другую страницу сбрасывает ошибку', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <ChunkErrorBoundary resetKey="/a">
        <Broken />
      </ChunkErrorBoundary>,
    );
    rerender(
      <ChunkErrorBoundary resetKey="/b">
        <p>Страница Б</p>
      </ChunkErrorBoundary>,
    );
    expect(screen.getByText('Страница Б')).toBeInTheDocument();
  });
});
