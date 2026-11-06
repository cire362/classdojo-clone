import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { openSync, type Font } from 'fontkit';
import type { StudentReport } from './student-report.service.js';

const regular = fileURLToPath(new URL('../../../assets/fonts/Lato-Regular.ttf', import.meta.url));
const bold = fileURLToPath(new URL('../../../assets/fonts/Lato-Bold.ttf', import.meta.url));
let glyphs: Font | undefined;
const INK = '#161a33', SOFT = '#4b5072', LINE = '#d8dbe8';
const fmt = (key: string) => key.split('-').reverse().join('.');
const plus = (n: number) => n ? `+${n}` : '0';
const signed = (n: number) => n > 0 ? `+${n}` : String(n);

/** A4; весь PDF и встраиваемые подмножества шрифтов собираются в памяти. */
export function reportPdf(report: StudentReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      bufferPages: true,
      autoFirstPage: false,
      info: {
        Title: `Отчёт по ученику: ${report.studentName}`,
        Author: report.teacherName,
        Creator: 'Герои класса',
        CreationDate: new Date(report.generatedAt),
      },
      lang: 'ru-RU',
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.once('error', reject);
    doc.once('end', () => resolve(Buffer.concat(chunks)));
    try {
      doc.registerFont('body', regular).registerFont('bold', bold);
      const font = (glyphs ??= openSync(regular) as Font);
      const margin = 48, width = 595.28 - margin * 2, bottom = 780;
      let y = margin, replaced = false;
      const printable = (text: string) => text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[\u2010-\u2015\u2212]/g, '-');
      const clean = (text: string) => [...printable(text)].map((char) => {
        const code = char.codePointAt(0)!;
        if (font.hasGlyphForCodePoint(code)) return char;
        replaced = true;
        return `[U+${code.toString(16).toUpperCase()}]`;
      }).join('');
      [
        report.studentName,
        report.groupName,
        report.teacherName,
        report.level.title,
        ...report.reasons.map((r) => r.name),
        ...report.attendance.records.map((r) => r.groupName),
      ].forEach(clean);
      const measure = (text: string, w: number, size = 10, face = 'body') =>
        doc.font(face).fontSize(size).heightOfString(clean(text), { width: w, lineGap: 2 });
      const text = (
        value: string, x: number, at: number, w: number, size = 10, face = 'body', color = INK, align: 'left' | 'right' = 'left',
      ) => {
        doc.font(face).fontSize(size).fillColor(color).text(clean(value), x, at, { width: w, lineGap: 2, align });
      };
      const page = (first = false) => {
        doc.addPage({ size: 'A4', margins: { top: margin, left: margin, right: margin, bottom: 56 } });
        y = margin;
        if (!first) {
          const label = `Отчёт по ученику: ${report.studentName}`;
          text(label, margin, y, width, 10, 'bold');
          y += measure(label, width, 10, 'bold') + 8;
          doc.strokeColor(LINE).lineWidth(0.5).moveTo(margin, y).lineTo(margin + width, y).stroke();
          y += 18;
        }
      };
      const ensure = (height: number) => { if (y + height > bottom) page(); };
      const paragraph = (value: string, size = 10, color = INK) => {
        const height = measure(value, width, size);
        ensure(height + 8); text(value, margin, y, width, size, 'body', color); y += height + 8;
      };
      const heading = (value: string) => { ensure(64); text(value, margin, y, width, 14, 'bold'); y += 27; };
      const table = (title: string, headers: string[], widths: number[], rows: string[][], empty: string) => {
        y += 16;
        const rowHeight = (cells: string[], face = 'body') =>
          Math.max(26, ...cells.map((cell, i) => measure(cell, widths[i] - 16, 9.5, face) + 14));
        const paint = (cells: string[], face: string, height: number, header: boolean) => {
          if (header) doc.rect(margin, y, width, height).fill('#eaecf4');
          let x = margin;
          cells.forEach((cell, i) => {
            text(cell, x + 8, y + 7, widths[i] - 16, 9.5, face, INK, i > 0 && title.startsWith('Причины') ? 'right' : 'left');
            x += widths[i];
          });
          y += height;
          doc.strokeColor(LINE).lineWidth(0.5).moveTo(margin, y).lineTo(margin + width, y).stroke();
        };
        const headerHeight = rowHeight(headers, 'bold');
        const begin = (continued: boolean) => {
          heading(title + (continued ? ' (продолжение)' : ''));
          paint(headers, 'bold', headerHeight, true);
        };
        ensure(27 + headerHeight + (rows[0] ? rowHeight(rows[0]) : 30));
        if (!rows.length) { heading(title); paragraph(empty, 10, SOFT); return; }
        begin(false);
        for (const cells of rows) {
          const height = rowHeight(cells);
          if (y + height > bottom) { page(); begin(true); }
          paint(cells, 'body', height, false);
        }
        y += 4;
      };

      page(true);
      text('Отчёт по ученику', margin, y, width, 22, 'bold'); y += 38;
      text(report.studentName, margin, y, width, 17, 'bold'); y += measure(report.studentName, width, 17, 'bold') + 12;
      paragraph(`Группа: ${report.groupName}`);
      paragraph(`Период: ${fmt(report.from)} - ${fmt(report.to)}. Даты по Москве.`);
      paragraph(`Преподаватель: ${report.teacherName}`);
      paragraph(`Текущий уровень: ${report.level.level}. ${report.level.title}`, 10, SOFT);
      paragraph('Уровень и название группы актуальны на дату формирования. Исправления учтены на момент выгрузки.', 8.5, SOFT);
      if (replaced) paragraph('Символы вне встроенного шрифта показаны кодами [U+XXXX].', 8.5, SOFT);
      y += 12;
      heading('Баллы за период');
      const tiles = [
        ['Начислено', plus(report.points.earned)],
        ['Списано', report.points.lost ? `-${report.points.lost}` : '0'],
        ['Итого', signed(report.points.net)],
      ];
      ensure(66);
      doc.rect(margin, y, width, 62).fill('#eaecf4');
      tiles.forEach(([label, value], i) => {
        const x = margin + 12 + i * width / 3;
        text(label, x, y + 10, width / 3 - 24, 9, 'body', SOFT);
        text(value, x, y + 28, width / 3 - 24, 16, 'bold');
      });
      y += 76;
      table(
        'Причины начислений и списаний',
        ['Причина', 'Записей', 'Плюсы', 'Минусы'],
        [width - 180, 60, 60, 60],
        report.reasons.map((r) => [r.name, String(r.count), plus(r.earned), r.lost ? `-${r.lost}` : '0']),
        'За выбранный период начислений и списаний нет.',
      );
      y += 10;
      const { total, attended, missed } = report.attendance;
      paragraph(`Посещаемость: отмечено ${total}, посещено ${attended}, пропущено ${missed}.`, 11);
      paragraph('Уроки без отметки не считаются пропусками. Траты в магазине не входят в суммы баллов.', 9, SOFT);
      table(
        'Отметки по урокам',
        ['Дата', 'Урок', 'Отметка', 'Группа'],
        [82, 44, 92, width - 218],
        report.attendance.records.map((r) => [fmt(r.date), String(r.lesson), r.present ? 'Посещение' : 'Пропуск', r.groupName]),
        'Отметок посещаемости за выбранный период нет.',
      );
      const STATUS = { NONE: 'Не сдано', PENDING: 'На проверке', APPROVED: 'Принято', RETURNED: 'На доработке' } as const;
      table(
        'Задания за период',
        ['Задание', 'Срок', 'Состояние', 'Баллы'],
        [width - 254, 82, 112, 60],
        report.assignments.map((a) => [a.title, a.dueOn ? fmt(a.dueOn) : 'Без срока', STATUS[a.status], a.points ? plus(a.points) : '-']),
        'За выбранный период заданий не было.',
      );
      table(
        'Опубликованные работы',
        ['Дата', 'Работа'],
        [82, width - 82],
        report.works.map((w) => [fmt(w.date), w.title]),
        'За выбранный период опубликованных работ нет.',
      );
      const pages = doc.bufferedPageRange();
      for (let i = pages.start; i < pages.start + pages.count; i++) {
        doc.switchToPage(i);
        const saved = doc.page.margins.bottom; doc.page.margins.bottom = 0;
        const at = doc.page.height - 34;
        const stamp = new Date(report.generatedAt)
          .toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' });
        text(`Герои класса | ${stamp} (МСК)`, margin, at, width / 2, 8, 'body', SOFT);
        text(`Страница ${i + 1} из ${pages.count}`, margin + width / 2, at, width / 2, 8, 'body', SOFT, 'right');
        doc.page.margins.bottom = saved;
      }
      doc.end();
    } catch (error) { doc.destroy(error as Error); }
  });
}
