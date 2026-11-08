import { normalizeHero } from '@heroes/shared';
import type { CardSummary, StreamAttendance, StreamBoard, StreamItem } from '@heroes/shared/api';
import { cap } from '@heroes/shared/terms';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../platform/db.js';
import { HttpError, notFound } from '../../platform/errors.js';
import { terms } from '../../platform/terms.js';
import { groupsOf } from '../access/index.js';
import { attendanceForDate, saveAttendance } from '../attendance/index.js';
import { awardPoints, cardSummaries } from '../points/index.js';
import { manualReason, manualReasons, matchingReason } from '../reasons/index.js';
import { checkSchoolSubject, groupsWithSubject } from '../subjects/index.js';

/**
 * Поток — занятие сразу для нескольких групп (лекция). Поток принадлежит преподавателю, в нём только
 * доступные ему группы. Баллы и отметки раскладываются по группам обычными начислениями: герои, сводки
 * и статистика групп ничего не знают о потоках.
 */
export interface StreamInput {
  name: string;
  groupIds: string[];
  subjectId: string | null;
}

/** Группы, в которых преподаватель может вести занятие: свои и соавторские, не в архиве */
const usable = (teacherId: string): Prisma.GroupWhereInput => ({ AND: [groupsOf(teacherId), { archivedAt: null }] });

const select = (teacherId: string) =>
  ({
    id: true,
    name: true,
    subjectId: true,
    subject: { select: { id: true, name: true } },
    groups: {
      where: { group: usable(teacherId) },
      orderBy: { group: { name: 'asc' } },
      select: { group: { select: { id: true, name: true } } },
    },
  }) satisfies Prisma.StreamSelect;

type Row = Prisma.StreamGetPayload<{ select: ReturnType<typeof select> }>;

const view = (s: Row): StreamItem => ({ id: s.id, name: s.name, subject: s.subject, groups: s.groups.map((g) => g.group) });

export async function teacherStreams(teacherId: string): Promise<StreamItem[]> {
  const rows = await prisma.stream.findMany({ where: { teacherId }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: select(teacherId) });
  return rows.map(view);
}

/** Поток для занятия: свой и хотя бы с одной доступной группой */
async function activeStream(teacherId: string, id: string) {
  const stream = await prisma.stream.findFirst({ where: { id, teacherId }, select: select(teacherId) });
  if (!stream) throw notFound('Поток не найден');
  if (!stream.groups.length) throw new HttpError(409, 'В потоке не осталось действующих групп');
  return { ...stream, groupIds: stream.groups.map((g) => g.group.id) };
}

async function checkInput(teacherId: string, schoolId: string | null, input: StreamInput) {
  const groupIds = [...new Set(input.groupIds)];
  if (groupIds.length < 2) throw new HttpError(400, 'В потоке должно быть хотя бы две группы');
  const count = await prisma.group.count({ where: { id: { in: groupIds }, ...usable(teacherId) } });
  if (count !== groupIds.length) throw notFound('Группа не найдена');
  return { name: input.name, groupIds, subjectId: await checkSchoolSubject(schoolId, input.subjectId) };
}

export async function createStream(teacherId: string, schoolId: string | null, input: StreamInput) {
  const data = await checkInput(teacherId, schoolId, input);
  await prisma.stream.create({
    data: { teacherId, name: data.name, subjectId: data.subjectId, groups: { create: data.groupIds.map((groupId) => ({ groupId })) } },
  });
  return teacherStreams(teacherId);
}

export async function updateStream(teacherId: string, schoolId: string | null, id: string, input: StreamInput) {
  const data = await checkInput(teacherId, schoolId, input);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.stream.updateMany({ where: { id, teacherId }, data: { name: data.name, subjectId: data.subjectId } });
    if (!count) throw notFound('Поток не найден');
    await tx.streamGroup.deleteMany({ where: { streamId: id } });
    await tx.streamGroup.createMany({ data: data.groupIds.map((groupId) => ({ streamId: id, groupId })) });
  });
  return teacherStreams(teacherId);
}

export async function deleteStream(teacherId: string, id: string) {
  const { count } = await prisma.stream.deleteMany({ where: { id, teacherId } });
  if (!count) throw notFound('Поток не найден');
  return teacherStreams(teacherId);
}

/** Ученики потока по группам и причины первой группы: они же предлагаются всем */
export async function streamBoard(teacherId: string, id: string): Promise<StreamBoard> {
  const stream = await activeStream(teacherId, id);
  const [students, reasons] = await Promise.all([
    prisma.student.findMany({
      where: { groupId: { in: stream.groupIds } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, groupId: true, hero: { select: { name: true, parts: true } } },
    }),
    manualReasons(stream.groupIds[0]),
  ]);
  const summaries = await cardSummaries(students.map((s) => s.id));
  return {
    stream: view(stream),
    groups: stream.groups.map(({ group }) => ({
      ...group,
      students: students
        .filter((s) => s.groupId === group.id)
        .map((s) => ({
          id: s.id,
          name: s.name,
          hero: { name: s.hero?.name ?? '', parts: normalizeHero(s.hero?.parts) },
          ...summaries.get(s.id)!,
        })),
    })),
    reasons,
  };
}

async function streamStudents(groupIds: string[], ids: string[]) {
  const students = await prisma.student.findMany({
    where: { id: { in: ids }, groupId: { in: groupIds } },
    select: { id: true, groupId: true },
  });
  if (students.length !== ids.length) throw notFound(`${cap(terms().student.one.nom)} не найден в потоке`);
  return students;
}

/**
 * Начисление по причине одной из групп потока. В остальных группах берётся такая же причина
 * (по названию и значению), а если её нет — создаётся копия: так баллы видны в причинах каждой группы.
 */
export async function awardInStream(teacherId: string, accountId: string, id: string, studentIds: string[], reasonId: string) {
  const stream = await activeStream(teacherId, id);
  const reason = await manualReason(reasonId, stream.groupIds);
  const ids = [...new Set(studentIds)];
  const students = await streamStudents(stream.groupIds, ids);
  const withSubject = await groupsWithSubject(stream.subjectId, stream.groupIds);
  for (const groupId of stream.groupIds) {
    const own = students.filter((s) => s.groupId === groupId).map((s) => s.id);
    if (!own.length) continue;
    await awardPoints({
      groupId,
      studentIds: own,
      reasonId: await matchingReason(groupId, reason),
      subjectId: withSubject.has(groupId) ? stream.subjectId : null,
      awardedById: accountId,
    });
  }
  const summaries: Record<string, CardSummary> = Object.fromEntries(await cardSummaries(ids));
  return { value: reason.value, summaries };
}

export async function streamAttendance(teacherId: string, id: string, date: string, lesson: number): Promise<StreamAttendance> {
  const stream = await activeStream(teacherId, id);
  const days = await Promise.all(stream.groupIds.map((groupId) => attendanceForDate(groupId, date, lesson)));
  return {
    date,
    lesson,
    marked: days.filter((d) => d.session).length,
    presentStudentIds: days.flatMap((d) => d.session?.presentStudentIds ?? []),
  };
}

/** Отметка занятия потока: у каждой группы своя отметка за этот урок, баллы «Посещение» как обычно */
export async function saveStreamAttendance(
  teacherId: string,
  accountId: string,
  id: string,
  params: { date: string; lesson: number; presentStudentIds: string[] },
) {
  const stream = await activeStream(teacherId, id);
  const present = [...new Set(params.presentStudentIds)];
  const marked = await streamStudents(stream.groupIds, present);
  const withSubject = await groupsWithSubject(stream.subjectId, stream.groupIds);
  let studentsTotal = 0;
  for (const groupId of stream.groupIds) {
    const result = await saveAttendance({
      groupId,
      date: params.date,
      lesson: params.lesson,
      presentStudentIds: marked.filter((s) => s.groupId === groupId).map((s) => s.id),
      peopleOnPhoto: null,
      subtractedTeacher: false,
      subjectId: withSubject.has(groupId) ? stream.subjectId : null,
      createdById: accountId,
    });
    studentsTotal += result.studentsTotal;
  }
  return { presentCount: present.length, studentsTotal };
}
