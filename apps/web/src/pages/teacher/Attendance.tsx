import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { CalendarBlankIcon, CameraIcon, CheckIcon, EyeSlashIcon, ImageIcon, InfoIcon, ListChecksIcon, PlusIcon, TrashIcon, WarningIcon } from '@phosphor-icons/react';
import { api, type AttendanceDay, type Detection } from '../../api';
import { HeroHead } from '../../components/HeroAvatar';
import { useToast } from '../../components/Toast';
import { ErrorBox, Modal, ProgressBar, Skeleton, Switch, Toggle } from '../../components/ui';
import { CancelledError, uploadForm, withRetry, type RetryStatus } from '../../lib/network';
import { dateKey, formatDate, pluralize, useLoad } from '../../hooks';
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

function uploadText({ progress, status }: { progress: number; status: RetryStatus | null }): string {
  if (!status) return 'Готовим фото…';
  if (status.state === 'offline') return 'Нет интернета. Отправим фото, как только связь появится';
  if (status.state === 'retrying') return `Связь прервалась. Пробуем ещё раз (${status.attempt} из ${status.attempts})…`;
  if (progress < 1) return `Отправляем фото… ${Math.round(progress * 100)}%`;
  return 'Считаем людей на фото…';
}

const shiftDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dateKey(d);
};

/** «сегодня», «вчера» или «пн, 26 октября» */
function dayLabel(key: string): string {
  if (key === dateKey()) return 'сегодня';
  if (key === shiftDays(-1)) return 'вчера';
  return formatDate(key).toLowerCase();
}

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
  const [date, setDateState] = useState(dateKey());
  // null — «последний отмеченный урок этого дня» (решает сервер)
  const [lesson, setLesson] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Подготовленное фото держим в памяти вкладки только для повторной отправки
  const photoRef = useRef<Blob | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [upload, setUpload] = useState<{ progress: number; status: RetryStatus | null }>({ progress: 0, status: null });
  const [saveStatus, setSaveStatus] = useState<RetryStatus | null>(null);
  // На телефоне статус отправки и ошибка ниже края экрана — прокручиваем к ним
  const statusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase === 'detecting' || error) statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [phase, error]);
  const existing = useLoad(
    () =>
      api<AttendanceDay>('GET', `/teacher/groups/${data.group.id}/attendance?date=${date}${lesson ? `&lesson=${lesson}` : ''}`),
    [data.group.id, date, lesson],
  );
  const isToday = date === dateKey();
  const day = existing.data?.date === date ? existing.data : null;
  const lessons = day?.lessons ?? [];
  const currentLesson = lesson ?? day?.lesson ?? 1;
  const nextLesson = Math.max(0, ...lessons.map((l) => l.lesson)) + 1;
  // Номер урока показываем, только когда в этот день уроков больше одного
  const multi = lessons.length > 1 || currentLesson > 1;
  const lessonLabel = multi ? `, ${currentLesson}-й урок` : '';

  function setDate(d: string) {
    setDateState(d);
    setLesson(null);
  }

  async function deleteLesson() {
    try {
      await api('DELETE', `/teacher/groups/${data.group.id}/attendance?date=${date}&lesson=${currentLesson}`);
      setConfirmDelete(false);
      setLesson(null);
      await Promise.all([reload(), existing.reload()]);
      toast({ text: 'Отметка урока удалена', tone: 'neutral' });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    }
  }

  // Фото живёт только в памяти вкладки: при уходе со страницы освобождаем его
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function startReview(det: Detection | null) {
    setDetection(det);
    // Если за этот день уже отмечали, подставляем прежнюю отметку, иначе все присутствуют
    const prev = day?.lesson === currentLesson ? day.session : null;
    setPresent(new Set(prev ? prev.presentStudentIds : data.students.map((s) => s.id)));
    setPhase('review');
  }

  function dropPhoto() {
    photoRef.current = null;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  /** Отправка фото с повторами: при обрыве связи пробуем ещё дважды, без сети ждём её появления */
  async function sendPhoto() {
    const blob = photoRef.current;
    if (!blob) return;
    setError(null);
    setPhase('detecting');
    setUpload({ progress: 0, status: null });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const det = await withRetry(
        () => {
          const form = new FormData();
          form.append('photo', blob, 'photo.jpg');
          setUpload((u) => ({ ...u, progress: 0 }));
          return uploadForm<Detection>(`/teacher/groups/${data.group.id}/attendance/detect`, form, {
            signal: controller.signal,
            timeoutMs: 45_000,
            onProgress: (progress) => setUpload((u) => ({ ...u, progress })),
          });
        },
        { signal: controller.signal, onStatus: (status) => setUpload((u) => ({ ...u, status })) },
      );
      startReview(det);
    } catch (e) {
      if (!(e instanceof CancelledError)) setError((e as Error).message);
      setPhase('start');
    } finally {
      abortRef.current = null;
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPhase('detecting');
    try {
      const blob = await prepareImage(file);
      dropPhoto();
      photoRef.current = blob;
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setError((e as Error).message);
      setPhase('start');
      return;
    } finally {
      if (cameraInput.current) cameraInput.current.value = '';
      if (galleryInput.current) galleryInput.current.value = '';
    }
    await sendPhoto();
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
    setSaveStatus(null);
    try {
      // Сохранение идемпотентно (отметка дня перезаписывается), поэтому его безопасно повторять
      await withRetry(
        () =>
          api('POST', `/teacher/groups/${data.group.id}/attendance`, {
            date,
            lesson: currentLesson,
            presentStudentIds: [...present],
            peopleOnPhoto: detection?.count ?? null,
            subtractedTeacher: detection ? subtract : false,
          }),
        { onStatus: setSaveStatus },
      );
      setSaved(present.size);
      dropPhoto();
      setDetection(null);
      setPhase('saved');
      setLesson(currentLesson);
      await Promise.all([reload(), existing.reload()]);
    } catch (e) {
      toast({ text: `${(e as Error).message}. Отметка не потерялась, нажмите «Сохранить» ещё раз`, tone: 'error' });
    } finally {
      setSaving(false);
      setSaveStatus(null);
    }
  }

  const inputs = (
    <>
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" aria-label="Сфотографировать группу" tabIndex={-1} className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={galleryInput} type="file" accept="image/*" aria-label="Выбрать фото группы" tabIndex={-1} className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
    </>
  );

  if (data.group.archivedAt) {
    return (
      <p className="max-w-xl rounded-2xl bg-surface-2 px-5 py-4 text-ink-soft">
        Группа в архиве, отмечать посещаемость нельзя. Прошлые уроки видны в статистике.
      </p>
    );
  }

  if (phase === 'saved') {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl space-y-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-plus-bg text-plus">
          <CheckIcon size={30} weight="bold" />
        </span>
        <h2 className="text-2xl">
          Посещаемость {isToday && !multi ? 'сохранена' : `за ${dayLabel(date)}${lessonLabel} сохранена`}
        </h2>
        <p className="text-ink-soft">
          Присутствуют {saved} из {data.students.length}. Каждый получил +1 за посещение
          {isToday ? '' : ' с датой урока'}. Фото удалено.
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {inputs}
        <div className="space-y-5">
          <h2 className="text-2xl">Отметить присутствующих</h2>
          <p className="max-w-[55ch] text-ink-soft">
            Сфотографируйте группу. Сервис посчитает людей на фото, а вы сверите список. Лица не распознаются, фото нигде
            не сохраняется.
          </p>
          <fieldset className="space-y-2">
            <legend className="label">День урока</legend>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: dateKey(), label: 'Сегодня' },
                { key: shiftDays(-1), label: 'Вчера' },
              ].map((o) => (
                <button key={o.key} className={`tab ${date === o.key ? 'active' : 'bg-surface-2'}`} onClick={() => setDate(o.key)} aria-pressed={date === o.key}>
                  {o.label}
                </button>
              ))}
              <label className={`tab cursor-pointer ${date < shiftDays(-1) ? 'active' : 'bg-surface-2'}`}>
                <CalendarBlankIcon size={18} weight="bold" />
                {date < shiftDays(-1) ? formatDate(date) : 'Другой день'}
                <input
                  type="date"
                  className="sr-only"
                  aria-label="Выбрать день урока"
                  value={date}
                  max={dateKey()}
                  min={shiftDays(-366)}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                />
              </label>
            </div>
          </fieldset>
          {lessons.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="label">Урок</legend>
              <div className="flex flex-wrap items-center gap-2">
                {lessons.map((l) => (
                  <button
                    key={l.lesson}
                    className={`tab ${currentLesson === l.lesson ? 'active' : 'bg-surface-2'}`}
                    onClick={() => setLesson(l.lesson)}
                    aria-pressed={currentLesson === l.lesson}
                  >
                    {l.lesson}-й урок
                    <span className="text-xs opacity-70 tabular-nums">
                      {l.presentCount}/{l.studentsTotal}
                    </span>
                  </button>
                ))}
                {nextLesson <= 8 && (
                  <button
                    className={`tab ${currentLesson === nextLesson ? 'active' : 'bg-surface-2'}`}
                    onClick={() => setLesson(nextLesson)}
                    aria-pressed={currentLesson === nextLesson}
                  >
                    <PlusIcon size={16} weight="bold" /> {currentLesson === nextLesson ? `${nextLesson}-й урок` : 'Ещё урок'}
                  </button>
                )}
              </div>
            </fieldset>
          )}
          {day?.session && day.lesson === currentLesson ? (
            <div className="space-y-2 rounded-xl bg-surface-2 px-4 py-3 text-sm">
              <p className="flex items-start gap-2">
                <InfoIcon size={20} className="mt-px shrink-0" />
                <span>
                  {multi ? `${currentLesson}-й урок уже отмечен` : `За ${dayLabel(date)} уже отмечено`}: были{' '}
                  {day.session.presentStudentIds.length} из {day.session.markedStudentIds.length}. Новая отметка заменит
                  прежнюю, баллы за посещение не задвоятся. В списке будет подставлена прежняя отметка.
                  {nextLesson <= 8 && ' Если это другой урок, выберите «Ещё урок».'}
                </span>
              </p>
              <button className="btn btn-ghost btn-sm -ml-3 text-minus hover:bg-minus-bg hover:text-minus" onClick={() => setConfirmDelete(true)}>
                <TrashIcon size={16} /> Удалить отметку этого урока
              </button>
            </div>
          ) : (
            currentLesson > 1 && (
              <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm">
                <InfoIcon size={20} className="mt-px shrink-0" />
                Новая отметка: {currentLesson}-й урок за {dayLabel(date)}. Каждый отмеченный получит ещё +1 за посещение.
              </p>
            )
          )}
          <Modal open={confirmDelete} title="Удалить отметку урока?" onClose={() => setConfirmDelete(false)}>
            <div className="space-y-5">
              <p>
                Отметка за {dayLabel(date)}
                {lessonLabel} и баллы «Посещение» за этот урок будут удалены у всех учеников.
              </p>
              <div className="flex gap-2">
                <button className="btn btn-danger" onClick={deleteLesson}>
                  Удалить
                </button>
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>
                  Отмена
                </button>
              </div>
            </div>
          </Modal>
          <div ref={statusRef} className="scroll-mb-6 space-y-5">
          {error && (
            <div className="space-y-2">
              <ErrorBox message={error} onRetry={photoRef.current ? () => void sendPhoto() : undefined} />
              <p className="text-sm text-ink-soft">Если связь не появится, можно отметить учеников вручную: «Без фото».</p>
            </div>
          )}
          {phase === 'detecting' ? (
            <div className="max-w-xl space-y-3" role="status" aria-live="polite">
              {preview ? (
                <img src={preview} alt="" className="max-h-44 w-full rounded-2xl object-cover opacity-60" />
              ) : (
                <Skeleton className="aspect-[4/3]" />
              )}
              {upload.status?.state === 'sending' && upload.progress < 1 && (
                <ProgressBar value={upload.progress} label="Отправка фото" />
              )}
              <p className="font-medium text-ink-soft">{uploadText(upload)}</p>
              {upload.status && (
                <button className="btn btn-secondary btn-sm" onClick={() => abortRef.current?.abort()}>
                  Отменить
                </button>
              )}
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
    <div className="grid grid-cols-1 gap-6 pb-24 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:pb-0">
      {(!isToday || multi) && (
        <p className="flex items-center gap-2 font-semibold lg:col-span-2">
          <CalendarBlankIcon size={20} weight="bold" /> Отметка за {dayLabel(date)}
          {lessonLabel}
        </p>
      )}
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
                  <Switch
                    checked={on}
                    label={`${s.name} присутствует`}
                    onChange={(v) =>
                      setPresent((prev) => {
                        const next = new Set(prev);
                        if (v) next.add(s.id);
                        else next.delete(s.id);
                        return next;
                      })
                    }
                  />
                </label>
              </li>
            );
          })}
        </ul>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <div className="mx-auto flex max-w-7xl gap-2">
            <button className="btn btn-primary btn-lg flex-1 lg:flex-none" onClick={save} disabled={saving}>
              {saving ? (saveStatus?.state === 'offline' ? 'Ждём интернет…' : saveStatus?.state === 'retrying' ? 'Повторяем…' : 'Сохраняем…') : 'Сохранить'}
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => {
                if (preview) URL.revokeObjectURL(preview);
                dropPhoto();
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
