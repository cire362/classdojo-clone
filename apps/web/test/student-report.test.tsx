import { act, fireEvent, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { StudentReport } from '../src/components/StudentReport';
import { fetchReport, saveReport } from '../src/lib/student-report-download';
import { renderApp } from './render';

vi.mock('../src/lib/student-report-download', () => ({ fetchReport: vi.fn(), saveReport: vi.fn() }));

it('выбранный период передаётся при скачивании, файл подписан именем ученика', async () => {
  const pdf = new Blob(['%PDF-']);
  vi.mocked(fetchReport).mockResolvedValue(pdf);
  const { user } = renderApp(<StudentReport studentId="s1" studentName="Алёна Иванова" />);
  await user.click(screen.getByText('Отчёт в PDF'));
  fireEvent.change(screen.getByLabelText('С'), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText('По'), { target: { value: '2026-01-31' } });
  await user.click(screen.getByRole('button', { name: 'Скачать PDF' }));
  expect(fetchReport).toHaveBeenCalledWith('s1', '2026-01-01', '2026-01-31');
  expect(saveReport).toHaveBeenCalledWith(pdf, 'Отчёт Алёна Иванова 2026-01-01_2026-01-31.pdf');
});

it('ошибка сохраняет даты, повторная загрузка работает и двойной запрос заблокирован', async () => {
  let resolve!: (b: Blob) => void;
  vi.mocked(fetchReport).mockRejectedValueOnce(new Error('Нет связи')).mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  const { user } = renderApp(<StudentReport studentId="s1" studentName="Алёна" />);
  await user.click(screen.getByText('Отчёт в PDF'));
  fireEvent.change(screen.getByLabelText('С'), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText('По'), { target: { value: '2026-01-31' } });
  await user.click(screen.getByRole('button', { name: 'Скачать PDF' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи');
  expect(screen.getByLabelText('С')).toHaveValue('2026-01-01');
  await user.click(screen.getByRole('button', { name: 'Скачать PDF' }));
  expect(screen.getByRole('button', { name: 'Готовим PDF…' })).toBeDisabled();
  await act(async () => resolve(new Blob(['%PDF-'])));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('пустые, перевёрнутые, будущие и слишком длинные периоды не скачиваются', async () => {
  const { user } = renderApp(<StudentReport studentId="s1" studentName="Алёна" />);
  await user.click(screen.getByText('Отчёт в PDF'));
  for (const [from, to] of [['', '2026-01-31'], ['2026-02-01', '2026-01-31'], ['2025-01-01', '2026-01-31'], ['9999-01-01', '9999-01-02']]) {
    fireEvent.change(screen.getByLabelText('С'), { target: { value: from } });
    fireEvent.change(screen.getByLabelText('По'), { target: { value: to } });
    expect(screen.getByRole('button', { name: 'Скачать PDF' })).toBeDisabled();
  }
});
