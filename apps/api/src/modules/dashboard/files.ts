import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { Dashboard, DashboardRow } from '@heroes/shared/api';
import { cap } from '@heroes/shared/terms';
import { terms } from '../../platform/terms.js';

const regular = fileURLToPath(new URL('../../../assets/fonts/Lato-Regular.ttf', import.meta.url));
const bold = fileURLToPath(new URL('../../../assets/fonts/Lato-Bold.ttf', import.meta.url));

const fmt = (key: string) => key.split('-').reverse().join('.');
const percent = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

/** Заголовки столбцов: первый зависит от разреза и словаря учреждения */
function headers(d: Dashboard) {
  const words = terms();
  const first = d.by === 'course' ? words.course : cap((d.by === 'department' ? words.department : words.group).one.nom);
  return [first, 'Групп', cap(words.student.many.nom), 'Вовлечённость', 'Уроков', 'Посещаемость', 'Плюсы', 'Минусы'];
}

const cells = (r: DashboardRow) => [r.name, r.groups, r.students, r.engagement, r.lessons, r.attendance, r.earned, r.lost ? -r.lost : 0];

export async function dashboardWorkbook(d: Dashboard, title: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Герои класса';
  wb.created = new Date();
  const sheet = wb.addWorksheet('Обзор', { views: [{ state: 'frozen', ySplit: 3 }] });
  sheet.mergeCells('A1:H1');
  sheet.getCell('A1').value = `${title}, ${fmt(d.from)} - ${fmt(d.to)}`;
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.columns = [{ width: 32 }, { width: 9 }, { width: 12 }, { width: 15 }, { width: 10 }, { width: 15 }, { width: 10 }, { width: 10 }];
  const head = sheet.getRow(3);
  head.values = headers(d);
  head.font = { bold: true };
  for (const r of [...d.rows, d.total]) {
    const added = sheet.addRow(cells(r));
    added.getCell(4).numFmt = '0%';
    added.getCell(6).numFmt = '0%';
    if (r === d.total) added.font = { bold: true };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** A4 альбомом: таблица разреза с итогом, страницы добавляются по мере заполнения */
export function dashboardPdf(d: Dashboard, title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4', layout: 'landscape', margin: 40, info: { Title: title, Creator: 'Герои класса' }, lang: 'ru-RU',
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.once('error', reject);
    doc.once('end', () => resolve(Buffer.concat(chunks)));
    try {
      doc.registerFont('body', regular).registerFont('bold', bold);
      const widths = [250, 60, 80, 100, 60, 100, 60, 51];
      const right = (i: number) => i > 0;
      const line = (values: (string | number)[], y: number, face: string) => {
        let x = 40;
        values.forEach((v, i) => {
          const align = right(i) ? 'right' : 'left';
          doc.font(face).fontSize(10).fillColor('#161a33').text(String(v), x + 4, y, { width: widths[i] - 8, align });
          x += widths[i];
        });
        return y + Math.max(18, doc.font(face).fontSize(10).heightOfString(String(values[0]), { width: widths[0] - 8 }) + 6);
      };
      const show = (r: DashboardRow) => [
        r.name, r.groups, r.students, percent(r.engagement), r.lessons, percent(r.attendance), `+${r.earned}`, r.lost ? `-${r.lost}` : '0',
      ];
      doc.font('bold').fontSize(16).fillColor('#161a33').text(title, 40, 40);
      doc.font('body').fontSize(11).fillColor('#4b5072').text(`Период: ${fmt(d.from)} - ${fmt(d.to)}`, 40, 64);
      let y = line(headers(d), 96, 'bold');
      for (const r of d.rows) {
        if (y > 520) {
          doc.addPage();
          y = line(headers(d), 40, 'bold');
        }
        y = line(show(r), y, 'body');
      }
      doc.moveTo(40, y).lineTo(801, y).strokeColor('#d8dbe8').stroke();
      line(show(d.total), y + 4, 'bold');
      doc.end();
    } catch (err) {
      reject(err as Error);
    }
  });
}
