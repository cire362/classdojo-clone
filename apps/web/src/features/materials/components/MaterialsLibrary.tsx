import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { EyeIcon, FileTextIcon, TrashIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import type { MaterialItem } from '../../../lib/api';
import { useLoad } from '../../../lib/hooks';
import { ErrorBox, Skeleton } from '../../../ui';
import { useToast } from '../../../ui/Toast';
import { deleteMaterial, fetchMaterials, materialFileUrl, uploadMaterial } from '../api';
import { KIND_LABEL, formatSize } from '../format';

const ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.ppt,.pptx,.odp,.xls,.xlsx,.ods,.txt,.md,.csv,.jpg,.jpeg,.png';

/** Библиотека методичек: загрузка своих материалов и материалы коллег учреждения */
export function MaterialsLibrary() {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => fetchMaterials(), []);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: '', description: '', shared: true });
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const list = Array.isArray(data) ? data : [];
  const mine = list.filter((m) => m.mine);
  const colleagues = list.filter((m) => !m.mine);

  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    const formElement = e.currentTarget;
    setBusy(true);
    setUploadError(null);
    try {
      const created = await uploadMaterial(file, form);
      setData([created, ...list]);
      setFile(null);
      setForm({ title: '', description: '', shared: true });
      formElement.reset();
      toast({ text: created.viewable ? 'Методичка добавлена' : 'Методичка добавлена, просмотр подготовится позже', tone: 'ok' });
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: MaterialItem) {
    try {
      await deleteMaterial(m.id);
      setData(list.filter((x) => x.id !== m.id));
      toast({ text: `«${m.title}» удалена`, tone: 'ok' });
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    }
  }

  const section = (title: string, items: MaterialItem[], empty: string) => (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-lg">{title}</h2>
      {items.length === 0 ? (
        <p className="text-ink-soft">{empty}</p>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {items.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 p-4">
              <FileTextIcon size={28} className="shrink-0 text-ink-soft" aria-hidden />
              <div className="min-w-0 flex-1 basis-52">
                <Link to={`/materials/${m.id}`} className="block break-words font-semibold underline-offset-2 hover:underline">
                  {m.title}
                </Link>
                <p className="text-sm text-ink-soft">
                  {[KIND_LABEL[m.kind], formatSize(m.size), m.mine ? (m.shared ? 'видят коллеги' : 'только вы') : m.author]
                    .join(' · ')}
                </p>
                {m.description && <p className="mt-1 break-words text-sm">{m.description}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/materials/${m.id}`} className="btn btn-secondary btn-sm" aria-label={`Смотреть: ${m.title}`}>
                  <EyeIcon size={18} /> Смотреть
                </Link>
                <a href={materialFileUrl(m.id)} className="btn btn-ghost btn-sm" download aria-label={`Скачать: ${m.title}`}>
                  Скачать
                </a>
                {m.mine && (
                  <button className="icon-btn hover:text-minus" aria-label={`Удалить: ${m.title}`} onClick={() => remove(m)}>
                    <TrashIcon size={20} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl">Методички</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Свои материалы к урокам: Word, PDF, PowerPoint, Excel, OpenDocument, картинки и текст. Всё открывается прямо здесь,
          без скачивания.
        </p>
      </div>

      <form onSubmit={upload} className="max-w-2xl space-y-4 rounded-2xl border border-dashed border-line p-5">
        <h2 className="flex items-center gap-2 text-lg">
          <UploadSimpleIcon size={20} weight="bold" /> Добавить методичку
        </h2>
        <div>
          <label className="label" htmlFor="material-file">Файл до 25 МБ</label>
          <input id="material-file" type="file" className="input" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label className="label" htmlFor="material-title">Название</label>
          <input
            id="material-title"
            className="input"
            maxLength={120}
            placeholder="По умолчанию — имя файла"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="material-description">Описание</label>
          <textarea
            id="material-description"
            className="input min-h-20"
            maxLength={1000}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="size-5"
            checked={form.shared}
            onChange={(e) => setForm({ ...form, shared: e.target.checked })}
          />
          Показать коллегам учреждения
        </label>
        {uploadError && <p role="alert" className="text-sm font-medium text-minus">{uploadError}</p>}
        <button className="btn btn-primary" disabled={busy || !file}>{busy ? 'Загружаем…' : 'Добавить'}</button>
      </form>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-40" />}
      {data && (
        <>
          {section('Мои методички', mine, 'Пока ничего нет. Добавьте первый файл.')}
          {section('Методички коллег', colleagues, 'Коллеги ещё не открыли свои материалы.')}
        </>
      )}
    </div>
  );
}
