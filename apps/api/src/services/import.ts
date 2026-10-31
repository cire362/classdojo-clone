import ExcelJS from 'exceljs';
import { HttpError } from '../platform/errors.js';

/**
 * Разбор списка учеников из Excel (.xlsx) или CSV. Ничего не создаёт: возвращает
 * найденные имена, а преподаватель подтверждает список в интерфейсе.
 */

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_NAMES = 200;

type Row = string[];

const NAME_HEADER = /^(фио|ф\.и\.о\.?|ученик|учащийся|обучающийся|имя и фамилия|фамилия,? имя|фамилия и имя|name|full ?name|student)$/i;
const LAST_HEADER = /^(фамилия|last ?name|surname)$/i;
const FIRST_HEADER = /^(имя|first ?name)$/i;

const clean = (v: string) => v.replace(/\s+/g, ' ').trim();

/** Похоже ли значение на имя человека: буквы, минимум 2 символа, не число и не дата */
function looksLikeName(v: string): boolean {
  return /^[\p{L}][\p{L}' .\-ёЁ]{1,79}$/u.test(v) && !/^\d/.test(v);
}

function decodeText(buf: Uint8Array): string {
  // Excel в русской Windows часто сохраняет CSV в кодировке windows-1251
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1251').decode(buf);
  }
}

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/);
  const sample = lines.slice(0, 20).join('\n');
  const delimiter = [';', '\t', ','].sort((a, b) => sample.split(b).length - sample.split(a).length)[0];
  const rows: Row[] = [];
  for (const line of lines) {
    // Простая поддержка кавычек: "Иванова, Мария";5
    const cells: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = !quoted;
      } else if (ch === delimiter && !quoted) {
        cells.push(cur);
        cur = '';
      } else cur += ch;
    }
    cells.push(cur);
    rows.push(cells.map(clean));
  }
  return rows;
}

async function parseXlsx(buf: Uint8Array): Promise<{ rows: Row[]; sheet: string }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(buf) as unknown as ArrayBuffer);
  } catch {
    throw new HttpError(422, 'Не удалось прочитать файл Excel. Сохраните его как .xlsx или .csv');
  }
  const ws = wb.worksheets.find((w) => w.actualRowCount > 0);
  if (!ws) throw new HttpError(422, 'В файле нет данных');
  const rows: Row[] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = clean(cell.text ?? '');
    });
    rows.push(Array.from(cells, (c) => c ?? ''));
  });
  return { rows, sheet: ws.name };
}

/** Ищем колонку с именами: по заголовку, иначе по содержимому */
function extractNames(rows: Row[]): { names: string[]; column: string } {
  const width = Math.max(0, ...rows.map((r) => r.length));
  for (let h = 0; h < Math.min(rows.length, 10); h++) {
    const header = rows[h];
    const last = header.findIndex((c) => LAST_HEADER.test(c));
    const first = header.findIndex((c) => FIRST_HEADER.test(c));
    if (last >= 0 && first >= 0) {
      const names = rows.slice(h + 1).map((r) => clean(`${r[first] ?? ''} ${r[last] ?? ''}`));
      return { names, column: `${header[first]} + ${header[last]}` };
    }
    const col = header.findIndex((c) => NAME_HEADER.test(c) || LAST_HEADER.test(c));
    if (col >= 0) return { names: rows.slice(h + 1).map((r) => r[col] ?? ''), column: header[col] };
  }
  // Заголовка нет: берём колонку, где больше всего значений похожи на имена
  let best = -1;
  let bestScore = 0;
  for (let c = 0; c < width; c++) {
    const score = rows.filter((r) => looksLikeName(r[c] ?? '')).length;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  if (best < 0) return { names: [], column: '' };
  return { names: rows.map((r) => r[best] ?? ''), column: `колонка ${best + 1}` };
}

export interface ImportPreview {
  names: string[];
  /** Сколько строк пропущено: пустые, не похожие на имя, повторы */
  skipped: number;
  source: string;
}

export async function previewImport(file: File): Promise<ImportPreview> {
  if (file.size > MAX_IMPORT_BYTES) throw new HttpError(413, 'Файл слишком большой (больше 2 МБ)');
  const name = file.name.toLowerCase();
  const buf = new Uint8Array(await file.arrayBuffer());
  if (name.endsWith('.xls')) throw new HttpError(415, 'Старый формат .xls не поддерживается. Сохраните файл как .xlsx или .csv');

  const isZip = buf[0] === 0x50 && buf[1] === 0x4b; // .xlsx — это zip-архив
  let rows: Row[];
  let source: string;
  if (isZip) {
    const r = await parseXlsx(buf);
    rows = r.rows;
    source = `лист «${r.sheet}»`;
  } else if (name.endsWith('.xlsx')) {
    throw new HttpError(422, 'Не удалось прочитать файл Excel. Сохраните его как .xlsx или .csv');
  } else {
    rows = parseCsv(decodeText(buf));
    source = 'CSV';
  }

  const { names: raw, column } = extractNames(rows);
  const seen = new Set<string>();
  const names: string[] = [];
  let skipped = 0;
  for (const v of raw) {
    const n = clean(v);
    if (!n) continue;
    const key = n.toLowerCase();
    if (!looksLikeName(n) || seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    names.push(n);
  }
  if (!names.length) throw new HttpError(422, 'Не нашли в файле имён учеников. Нужна колонка «ФИО» или «Фамилия» и «Имя»');
  if (names.length > MAX_NAMES) throw new HttpError(422, `В файле больше ${MAX_NAMES} имён`);
  return { names, skipped, source: column ? `${source}, ${column}` : source };
}
