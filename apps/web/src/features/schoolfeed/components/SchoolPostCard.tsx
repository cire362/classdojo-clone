import type { ReactNode } from 'react';
import { MegaphoneIcon } from '@phosphor-icons/react';
import type { AdminSchoolPost } from '../../../lib/api';
import { AttachedFiles } from '../../../ui/Attachments';

const postedAt = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** Запись ленты школы. Объявление всем семьям выделено; schoolName показывается, если школ несколько */
export function SchoolPostCard({ post, schoolName, isNew, level = 3, children }: {
  post: Omit<AdminSchoolPost, 'reach'>;
  /** Уровень заголовка записи: на отдельной странице ленты — 2, внутри раздела панели — 3 */
  level?: 2 | 3;
  schoolName?: string;
  isNew?: boolean;
  children?: ReactNode;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <article className={`card space-y-3 p-5 ${post.important ? 'ring-2 ring-accent' : ''}`} aria-labelledby={`school-post-${post.id}`}>
      <header className="flex flex-wrap items-center gap-2">
        {post.important && (
          <span className="chip bg-accent text-on-accent">
            <MegaphoneIcon size={16} weight="bold" aria-hidden /> Объявление
          </span>
        )}
        {isNew && <span className="chip bg-surface-2">Новое</span>}
        <Heading id={`school-post-${post.id}`} className="min-w-0 font-sans text-base font-semibold tracking-normal">
          {schoolName ? `${schoolName} · ` : ''}
          {post.author}
        </Heading>
        <time className="text-sm text-ink-soft" dateTime={post.createdAt}>{postedAt(post.createdAt)}</time>
      </header>
      {post.text && <p className="whitespace-pre-wrap break-words">{post.text}</p>}
      {post.files.length > 0 && <AttachedFiles files={post.files} />}
      {children}
    </article>
  );
}
