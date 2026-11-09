import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ArrowSquareOutIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { fetchMaterials, materialFileUrl, materialViewUrl } from '../api';
import { KIND_LABEL, formatSize } from '../format';

/**
 * Просмотр методички на странице. PDF и копии документов Office показывает встроенный просмотрщик браузера,
 * картинки — как картинку. Скачивать не нужно, но кнопка есть
 */
export function MaterialViewer({ materialId }: { materialId: string }) {
  const { data, error, reload } = useLoad(() => fetchMaterials(), []);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-96" />;
  const material = data.find((m) => m.id === materialId);
  if (!material) return <ErrorBox message="Методичка не найдена или автор закрыл её" onRetry={reload} />;
  const viewUrl = materialViewUrl(material.id);
  return (
    <div className="space-y-4">
      <Link to="/materials" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeftIcon size={16} /> Все методички
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl sm:text-3xl">{material.title}</h1>
          <p className="mt-1 text-ink-soft">{[KIND_LABEL[material.kind], formatSize(material.size), material.author].join(' · ')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={viewUrl} target="_blank" rel="noopener" className="btn btn-secondary">
            <ArrowSquareOutIcon size={20} /> Во весь экран
          </a>
          <a href={materialFileUrl(material.id)} download className="btn btn-ghost">
            <DownloadSimpleIcon size={20} /> Скачать
          </a>
        </div>
      </div>
      {material.description && <p className="max-w-3xl break-words">{material.description}</p>}
      {material.kind === 'image' ? (
        <img src={viewUrl} alt={material.title} className="mx-auto max-h-[80vh] rounded-2xl border border-line" />
      ) : (
        <iframe
          src={viewUrl}
          title={`Просмотр: ${material.title}`}
          className="h-[80vh] w-full rounded-2xl border border-line bg-surface"
        />
      )}
      {!material.viewable && (
        <p className="text-sm text-ink-soft">Если просмотр не открылся, он готовится. Обновите страницу через минуту или скачайте файл.</p>
      )}
    </div>
  );
}
