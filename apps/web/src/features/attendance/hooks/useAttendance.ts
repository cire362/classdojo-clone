import { useEffect, useRef, useState } from 'react';
import { useGroup } from '../../groups';
import type { Detection } from '../../../lib/api';
import { dateKey, useLoad } from '../../../lib/hooks';
import { CancelledError, withRetry, type RetryStatus } from '../../../lib/network';
import { useToast } from '../../../ui/Toast';
import { deleteAttendance, detectPeople, fetchAttendanceDay, saveAttendance, setSubtractTeacher } from '../api';
import { prepareImage } from '../photo';

type Phase = 'start' | 'detecting' | 'review' | 'saved';

/** Отметка урока: фото, подсчёт, сверка списка и сохранение */
export function useAttendance() {
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
  const existing = useLoad(() => fetchAttendanceDay(data.group.id, date, lesson), [data.group.id, date, lesson]);
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

  async function removeLesson() {
    try {
      await deleteAttendance(data.group.id, date, currentLesson);
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
          return detectPeople(data.group.id, form, {
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
      await setSubtractTeacher(data.group.id, v);
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
          saveAttendance(data.group.id, {
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

  function cancelReview() {
    if (preview) URL.revokeObjectURL(preview);
    dropPhoto();
    setDetection(null);
    setPhase('start');
  }

  return {
    data, phase, setPhase, preview, detection, error, present, setPresent, subtract, saving, saved, date, setDate, setLesson,
    confirmDelete, setConfirmDelete, photoRef, abortRef, upload, saveStatus, statusRef, cameraInput, galleryInput, isToday, day, lessons,
    currentLesson, nextLesson, multi, lessonLabel, removeLesson, startReview, sendPhoto, onFile, changeSubtract, save, cancelReview,
  };
}

export type AttendanceFlow = ReturnType<typeof useAttendance>;
