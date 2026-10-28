import ExcelJS from 'exceljs';
import { levelForPoints } from '@heroes/shared';
import { prisma } from '../db.js';
import { addDays, dbDate, dbDateKey, localDayStart } from '../lib/dates.js';

export async function groupStats(groupId: string, from: string, to: string) {
  const start = localDayStart(from);
  const end = addDays(localDayStart(to), 1);

  const [students, plus, minus, allTimeEarned, sessions] = await Promise.all([
    prisma.student.findMany({
      where: { groupId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, account: { select: { login: true } } },
    }),
    prisma.pointEvent.groupBy({
      by: ['studentId'],
      where: { student: { groupId }, value: { gt: 0 }, createdAt: { gte: start, lt: end } },
      _sum: { value: true },
    }),
    prisma.pointEvent.groupBy({
      by: ['studentId'],
      where: { student: { groupId }, value: { lt: 0 }, createdAt: { gte: start, lt: end } },
      _sum: { value: true },
    }),
    prisma.pointEvent.groupBy({
      by: ['studentId'],
      where: { student: { groupId }, value: { gt: 0 } },
      _sum: { value: true },
    }),
    prisma.attendanceSession.findMany({
      where: { groupId, date: { gte: dbDate(from), lte: dbDate(to) } },
      orderBy: { date: 'asc' },
      include: { records: { select: { studentId: true, present: true } } },
    }),
  ]);

  const plusMap = new Map(plus.map((r) => [r.studentId, r._sum.value ?? 0]));
  const minusMap = new Map(minus.map((r) => [r.studentId, -(r._sum.value ?? 0)]));
  const allMap = new Map(allTimeEarned.map((r) => [r.studentId, r._sum.value ?? 0]));

  const rows = students.map((s) => {
    const earned = plusMap.get(s.id) ?? 0;
    const lost = minusMap.get(s.id) ?? 0;
    const marked = sessions.filter((ses) => ses.records.some((r) => r.studentId === s.id));
    const attended = marked.filter((ses) => ses.records.some((r) => r.studentId === s.id && r.present)).length;
    return {
      id: s.id,
      name: s.name,
      login: s.account.login,
      earned,
      lost,
      net: earned - lost,
      level: levelForPoints(allMap.get(s.id) ?? 0).level,
      attended,
      sessions: marked.length,
      attendanceRate: marked.length ? attended / marked.length : null,
    };
  });

  return {
    from,
    to,
    students: rows,
    sessions: sessions.map((s) => ({
      id: s.id,
      date: dbDateKey(s.date),
      peopleOnPhoto: s.peopleOnPhoto,
      subtractedTeacher: s.subtractedTeacher,
      presentCount: s.records.filter((r) => r.present).length,
      studentsTotal: s.records.length,
      present: s.records.filter((r) => r.present).map((r) => r.studentId),
    })),
  };
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B1F4B' } };

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 30;
}

const fmtDate = (key: string) => key.split('-').reverse().join('.');

export async function statsWorkbook(groupId: string, groupName: string, from: string, to: string): Promise<Buffer> {
  const stats = await groupStats(groupId, from, to);
  const events = await prisma.pointEvent.findMany({
    where: { student: { groupId }, createdAt: { gte: localDayStart(from), lt: addDays(localDayStart(to), 1) } },
    orderBy: { createdAt: 'asc' },
    include: { student: { select: { name: true } } },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Герои класса';
  wb.created = new Date();

  // Лист 1 — сводка
  const summary = wb.addWorksheet('Сводка', { views: [{ state: 'frozen', ySplit: 3 }] });
  summary.mergeCells('A1:H1');
  summary.getCell('A1').value = `Группа «${groupName}», ${fmtDate(from)} — ${fmtDate(to)}`;
  summary.getCell('A1').font = { bold: true, size: 14 };
  summary.columns = [
    { key: 'name', width: 28 },
    { key: 'login', width: 16 },
    { key: 'earned', width: 12 },
    { key: 'lost', width: 12 },
    { key: 'net', width: 10 },
    { key: 'level', width: 9 },
    { key: 'attended', width: 14 },
    { key: 'rate', width: 14 },
  ];
  const head = summary.getRow(3);
  head.values = ['Ученик', 'Логин', 'Плюсы', 'Минусы', 'Итого', 'Уровень', 'Был на уроках', 'Посещаемость'];
  styleHeader(head);
  for (const s of stats.students) {
    const row = summary.addRow({
      name: s.name,
      login: s.login,
      earned: s.earned,
      lost: s.lost ? -s.lost : 0,
      net: s.net,
      level: s.level,
      attended: s.sessions ? `${s.attended} из ${s.sessions}` : '—',
      rate: s.attendanceRate,
    });
    row.getCell('rate').numFmt = '0%';
  }

  // Лист 2 — посещаемость (ученики × даты)
  const att = wb.addWorksheet('Посещаемость', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
  att.columns = [{ width: 28 }, ...stats.sessions.map(() => ({ width: 12 })), { width: 10 }];
  const attHead = att.getRow(1);
  attHead.values = ['Ученик', ...stats.sessions.map((s) => fmtDate(s.date)), 'Итого'];
  styleHeader(attHead);
  for (const s of stats.students) {
    const marks = stats.sessions.map((ses) => (ses.present.includes(s.id) ? '✓' : '—'));
    const row = att.addRow([s.name, ...marks, s.sessions ? `${s.attended}/${s.sessions}` : '—']);
    row.eachCell((cell, col) => {
      if (col > 1) cell.alignment = { horizontal: 'center' };
      if (cell.value === '✓') cell.font = { color: { argb: 'FF2A9D55' }, bold: true };
      if (cell.value === '—' && col <= stats.sessions.length + 1) cell.font = { color: { argb: 'FFE63946' } };
    });
  }
  if (stats.sessions.length) {
    att.addRow([]);
    att.addRow(['Людей на фото', ...stats.sessions.map((s) => s.peopleOnPhoto ?? 'без фото')]);
    att.addRow(['Отмечено присутствующих', ...stats.sessions.map((s) => s.presentCount)]);
  }

  // Лист 3 — история начислений
  const hist = wb.addWorksheet('История', { views: [{ state: 'frozen', ySplit: 1 }] });
  hist.columns = [{ width: 18 }, { width: 28 }, { width: 32 }, { width: 10 }];
  const histHead = hist.getRow(1);
  histHead.values = ['Дата и время', 'Ученик', 'Причина', 'Баллы'];
  styleHeader(histHead);
  for (const e of events) {
    // Excel не знает о часовых поясах — записываем «настенное» локальное время
    const local = new Date(e.createdAt.getTime() - e.createdAt.getTimezoneOffset() * 60_000);
    const row = hist.addRow([local, e.student.name, `${e.emoji} ${e.reasonName}`, e.value]);
    row.getCell(1).numFmt = 'dd.mm.yyyy hh:mm';
    row.getCell(4).font = { color: { argb: e.value > 0 ? 'FF2A9D55' : 'FFE63946' }, bold: true };
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
