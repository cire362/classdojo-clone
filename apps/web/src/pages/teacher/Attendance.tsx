import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { CameraIcon, CheckIcon, EyeSlashIcon, ImageIcon, InfoIcon, ListChecksIcon, WarningIcon } from '@phosphor-icons/react';
import { api, type Detection } from '../../api';
import { HeroHead } from '../../components/HeroAvatar';
import { useToast } from '../../components/Toast';
import { ErrorBox, Skeleton, Toggle } from '../../components/ui';
import { pluralize } from '../../hooks';
import { useGroup } from './GroupLayout';

const MAX_SIDE = 1600;

/**
 * Уменьшаем фото в браузере: быстрее загрузка с телефона, учитывается поворот
 * из EXIF, а сами EXIF-метаданные (геолокация и т.п.) не уходят на сервер.
 */
async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось обработать фото'))), 'image/jpeg', 0.88),
  );
}

type Phase = 'start' | 'detecting' | 'review' | 'saved';

export function AttendancePage() {
  const { data, setData, reload } = useGroup();
  const toast = useToast();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('start');
  const [preview, setPreview] = useState<string | null>(null);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [subtract, setSubtract] = useState(data.group.subtractTeacher);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<number>(0);

  // Фото живёт только в памяти вкладки: при уходе со страницы освобождаем его
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function startReview(det: Detection | null) {
    setDetection(det);
    setPresent(new Set(data.students.map((s) => s.id)));
    setPhase('review');
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPhase('detecting');
    try {
      const blob = await prepareImage(file);
      setPreview(URL.createObjectURL(blob));
      const form = new FormData();
      form.append('photo', blob, 'photo.jpg');
      const det = await api<Detection>('POST', `/teacher/groups/${data.group.id}/attendance/detect`, form);
      startReview(det);
    } catch (e) {
      setError((e as Error).message);
      setPhase('start');
    } finally {
      if (cameraInput.current) cameraInput.current.value = '';
      if (galleryInput.current) galleryInput.current.value = '';
    }
  }

  async function changeSubtract(v: boolean) {
    setSubtract(v);
    try {
      await api('PATCH', `/teacher/groups/${data.group.id}`, { subtractTeacher: v });
      setData({ ...data, group: { ...data.group, subtractTeacher: v } });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    }
  }

  async function save() {
    setSaving(true);
    try {
      await api('POST', `/teacher/groups/${data.group.id}/attendance`, {
        presentStudentIds: [...present],
        peopleOnPhoto: detection?.count ?? null,
        subtractedTeacher: detection ? subtract : false,
      });
      setSaved(present.size);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setDetection(null);
      setPhase('saved');
      await reload();
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const inputs = (
    <>
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={galleryInput} type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
    </>
  );

  if (phase === 'saved') {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl space-y-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-plus-bg text-plus">
          <CheckIcon size={30} weight="bold" />
        </span>
        <h2 className="text-2xl">Посещаемость сохранена</h2>
        <p className="text-ink-soft">
          Присутствуют {saved} из {data.students.length}. Каждый получил +1 за посещение. Фото удалено.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to={`/g/${data.group.id}`} className="btn btn-primary">
            К уроку
          </Link>
          <button className="btn btn-secondary" onClick={() => setPhase('start')}>
            Отметить заново
          </button>
        </div>
      </motion.div>
    );
  }

  if (phase === 'start' || phase === 'detecting') {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {inputs}
        <div className="space-y-5">
          <h2 className="text-2xl">Отметить присутствующих</h2>
          <p className="max-w-[55ch] text-ink-soft">
            Сфотографируйте группу. Сервис посчитает людей на фото, а вы сверите список. Лица не распознаются, фото нигде
            не сохраняется.
          </p>
          {data.todayAttendance && (
            <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm">
              <InfoIcon size={20} className="mt-px shrink-0" />
              Сегодня уже отмечено {data.todayAttendance.presentStudentIds.length} из {data.students.length}. Новая отметка
              заменит прежнюю, баллы за посещение не задвоятся.
            </p>
          )}
          {error && <ErrorBox message={error} />}
          {phase === 'detecting' ? (
            <div className="space-y-3" role="status">
              <Skeleton className="aspect-[4/3] max-w-xl" />
              <p className="font-medium text-ink-soft">Считаем людей на фото…</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary btn-lg" onClick={() => cameraInput.current?.click()} disabled={!data.students.length}>
                <CameraIcon size={22} weight="bold" /> Сфотографировать
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => galleryInput.current?.click()} disabled={!data.students.length}>
                <ImageIcon size={22} /> Выбрать фото
              </button>
              <button className="btn btn-ghost btn-lg" onClick={() => startReview(null)} disabled={!data.students.length}>
                <ListChecksIcon size={22} /> Без фото
              </button>
            </div>
          )}
        </div>
        <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5" aria-hidden>
          {data.students.map((s) => (
            <HeroHead key={s.id} parts={s.hero.parts} className="size-12" />
          ))}
        </div>
        <ul className="h-fit space-y-3 rounded-2xl bg-surface-2 p-5 text-sm">
          <li className="flex gap-3">
            <EyeSlashIcon size={20} className="shrink-0" />
            Сервис только считает людей и не знает, кто есть кто.
          </li>
          <li className="flex gap-3">
            <CameraIcon size={20} className="shrink-0" />
            Встаньте так, чтобы в кадр попали все. Лучше при хорошем свете.
          </li>
          <li className="flex gap-3">
            <CheckIcon size={20} className="shrink-0" />
            Каждый отмеченный получит +1 «Посещение».
          </li>
        </ul>
        </div>
      </div>
    );
  }

  // Экран сверки
  const total = data.students.length;
  const expected = detection ? Math.max(0, detection.count - (subtract ? 1 : 0)) : null;
  const mismatch = expected !== null && expected !== present.size;

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:pb-0">
      {detection && preview ? (
        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-surface-2">
            <img src={preview} alt="Фото группы" className="block w-full" />
            <svg className="absolute inset-0 size-full" viewBox={`0 0 ${detection.width} ${detection.height}`} preserveAspectRatio="none" aria-hidden>
              {detection.boxes.map((b, i) => (
                <motion.rect
                  key={i}
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  rx={8}
                  fill="rgb(255 194 51 / 0.12)"
                  stroke="#ffc233"
                  strokeWidth={Math.max(3, detection.width / 300)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05 * i }}
                />
              ))}
            </svg>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <p className="font-display text-2xl">
              На фото {detection.count} {pluralize(detection.count, 'человек', 'человека', 'человек')}
            </p>
            <p className="text-ink-soft">
              {subtract ? 'Без преподавателя ' : 'Из них учеников '}
              {expected}, в группе {total}
            </p>
          </div>
          <Toggle checked={subtract} onChange={changeSubtract} label="Я тоже в кадре" hint="Вычитать преподавателя из числа людей на фото" />
        </section>
      ) : (
        <section className="space-y-2">
          <h2 className="text-2xl">Отметка без фото</h2>
          <p className="text-ink-soft">Снимите отметку с тех, кого нет на уроке.</p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg">
            Отмечено {present.size} из {total}
          </h3>
          <div className="flex gap-1">
            <button className="btn btn-ghost btn-sm" onClick={() => setPresent(new Set(data.students.map((s) => s.id)))}>
              Все
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setPresent(new Set())}>
              Никого
            </button>
          </div>
        </div>
        {mismatch && (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-accent/25 px-4 py-3 text-sm font-medium">
            <WarningIcon size={20} className="mt-px shrink-0" />
            На фото {expected} {pluralize(expected!, 'ученик', 'ученика', 'учеников')}, а отмечено {present.size}. Проверьте
            список, сохранить можно и так.
          </p>
        )}
        <ul className="card divide-y divide-line overflow-hidden">
          {data.students.map((s) => {
            const on = present.has(s.id);
            return (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 transition hover:bg-surface-2">
                  <HeroHead parts={s.hero.parts} className={`size-11 transition ${on ? '' : 'opacity-40 grayscale'}`} />
                  <span className={`flex-1 font-medium ${on ? '' : 'text-ink-soft line-through decoration-1'}`}>{s.name}</span>
                  <span className={`text-sm font-semibold ${on ? 'text-plus' : 'text-ink-soft'}`}>{on ? 'был' : 'не был'}</span>
                  <Toggle
                    checked={on}
                    onChange={(v) =>
                      setPresent((prev) => {
                        const next = new Set(prev);
                        if (v) next.add(s.id);
                        else next.delete(s.id);
                        return next;
                      })
                    }
                    label={<span className="sr-only">{s.name} присутствует</span>}
                  />
                </label>
              </li>
            );
          })}
        </ul>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <div className="mx-auto flex max-w-7xl gap-2">
            <button className="btn btn-primary btn-lg flex-1 lg:flex-none" onClick={save} disabled={saving}>
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => {
                if (preview) URL.revokeObjectURL(preview);
                setPreview(null);
                setDetection(null);
                setPhase('start');
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
