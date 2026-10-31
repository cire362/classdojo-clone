import { Component, type ReactNode } from 'react';
import { WarningIcon } from '@phosphor-icons/react';

/**
 * Если не удалось загрузить код страницы (пропал интернет), показываем понятное
 * сообщение вместо пустого экрана. resetKey — сбрасывает ошибку при переходе на другую страницу.
 */
export class ChunkErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-5">
        <span className="flex items-center gap-2 font-semibold">
          <WarningIcon size={22} weight="bold" /> Не удалось загрузить страницу
        </span>
        <p className="text-sm text-ink-soft">Похоже, пропал интернет. Когда связь появится, обновите страницу.</p>
        <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
          Обновить
        </button>
      </div>
    );
  }
}
