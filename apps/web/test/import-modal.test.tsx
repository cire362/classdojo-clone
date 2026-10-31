import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ImportStudentsModal } from '../src/features/students/components/ImportStudentsModal';
import { renderApp } from './render';

const preview = {
  source: 'лист «7Б», ФИО',
  skipped: 1,
  names: [
    { name: 'Гусев Роман Андреевич', alreadyInGroup: false },
    { name: 'Титова Яна Сергеевна', alreadyInGroup: true },
    { name: 'Ершов Оскар Ильич', alreadyInGroup: false },
  ],
};

describe('окно импорта учеников', () => {
  it('для списка ФИО сразу предлагает «Имя Фамилия», уже добавленных не отмечает', async () => {
    const onConfirm = vi.fn();
    const { user } = renderApp(<ImportStudentsModal preview={preview} busy={false} onClose={() => {}} onConfirm={onConfirm} />);
    expect(screen.getByText('Роман Гусев')).toBeInTheDocument();
    expect(screen.getByText('уже в группе')).toBeInTheDocument();
    expect(screen.getByText('Выбрано 2 из 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Добавить 2' }));
    expect(onConfirm).toHaveBeenCalledWith(['Роман Гусев', 'Оскар Ершов']);
  });

  it('переключатели меняют формат, галочки — состав', async () => {
    const onConfirm = vi.fn();
    const { user } = renderApp(<ImportStudentsModal preview={preview} busy={false} onClose={() => {}} onConfirm={onConfirm} />);
    await user.click(screen.getByText('Сначала имя, потом фамилия'));
    await user.click(screen.getByText('Без отчества'));
    expect(screen.getByText('Гусев Роман Андреевич')).toBeInTheDocument();
    await user.click(screen.getByText('Ершов Оскар Ильич'));
    await user.click(screen.getByRole('button', { name: 'Добавить 1' }));
    expect(onConfirm).toHaveBeenCalledWith(['Гусев Роман Андреевич']);
  });
});
