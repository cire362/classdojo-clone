import { CalendarBlankIcon, CameraIcon, CheckIcon, EyeSlashIcon, ImageIcon, InfoIcon, ListChecksIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { HeroHead } from '../../hero';
import { dateKey, formatDate } from '../../../lib/hooks';
import { ErrorBox, Modal, ProgressBar, Skeleton } from '../../../ui';
import type { AttendanceFlow } from '../hooks/useAttendance';
import { dayLabel, shiftDays, uploadText } from '../labels';

/** Выбор дня и урока, фото группы и отправка на подсчёт */
export function AttendanceStart({ flow }: { flow: AttendanceFlow }) {
  const {
    data, phase, preview, error, date, setDate, setLesson, confirmDelete, setConfirmDelete, photoRef, abortRef, upload, statusRef,
    cameraInput, galleryInput, day, lessons, currentLesson, nextLesson, multi, lessonLabel, removeLesson, startReview, sendPhoto, onFile,
  } = flow;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" aria-label="Сфотографировать группу" tabIndex={-1} className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={galleryInput} type="file" accept="image/*" aria-label="Выбрать фото группы" tabIndex={-1} className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
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
              <button className="btn btn-danger" onClick={removeLesson}>
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
