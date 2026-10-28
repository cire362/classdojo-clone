import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { call, setupTeacher } from './helpers.js';

/** Кодирование в windows-1251 (только кириллица и ASCII) — так Excel сохраняет CSV в русской Windows */
function cp1251(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from([...s].map((ch) => {
    const c = ch.charCodeAt(0);
    if (c < 128) return c;
    if (c >= 0x410 && c <= 0x44f) return c - 0x410 + 0xc0;
    if (ch === 'Ё') return 0xa8;
    if (ch === 'ё') return 0xb8;
    return 0x3f;
  }));
}

async function upload(groupId: string, cookie: string, data: BlobPart, filename: string) {
  const form = new FormData();
  form.append('file', new File([data], filename));
  return call('POST', `/api/teacher/groups/${groupId}/students/import-preview`, { cookie, raw: form });
}

describe('импорт учеников из файла', () => {
  it('xlsx с колонкой «ФИО», номерами и пустыми строками', async () => {
    const t = await setupTeacher(['Мария Иванова']);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('5А');
    ws.addRow(['Список класса']);
    ws.addRow(['№', 'ФИО', 'Дата рождения']);
    ws.addRow([1, 'Смирнов Пётр Ильич', new Date('2015-03-01')]);
    ws.addRow([2, 'Мария Иванова', '']);
    ws.addRow([]);
    ws.addRow([3, '  Ёлкина   Алёна ', '']);
    ws.addRow([4, 'Смирнов Пётр Ильич', '']);
    const buf = await wb.xlsx.writeBuffer();
    const res = await upload(t.group.id, t.cookie, new Uint8Array(buf as ArrayBuffer), 'класс.xlsx');
    expect(res.status).toBe(200);
    expect(res.body.names).toEqual([
      { name: 'Смирнов Пётр Ильич', alreadyInGroup: false },
      { name: 'Мария Иванова', alreadyInGroup: true },
      { name: 'Ёлкина Алёна', alreadyInGroup: false },
    ]);
    expect(res.body.skipped).toBe(1);
    expect(res.body.source).toContain('ФИО');
  });

  it('xlsx с отдельными колонками «Фамилия» и «Имя» собирается в «Имя Фамилия»', async () => {
    const t = await setupTeacher([]);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Лист1');
    ws.addRow(['Фамилия', 'Имя', 'Класс']);
    ws.addRow(['Котова', 'Оля', '5А']);
    ws.addRow(['Ли', 'Ян', '5А']);
    const buf = await wb.xlsx.writeBuffer();
    const res = await upload(t.group.id, t.cookie, new Uint8Array(buf as ArrayBuffer), 'list.xlsx');
    expect(res.body.names.map((n: any) => n.name)).toEqual(['Оля Котова', 'Ян Ли']);
  });

  it('CSV в windows-1251 с точкой с запятой и без заголовка', async () => {
    const t = await setupTeacher([]);
    const csv = '1;Белова Соня;5А\r\n2;Ахметов Тимур;5А\r\n3;"Зайцева, Ника";5А\r\n';
    const res = await upload(t.group.id, t.cookie, cp1251(csv), 'export.csv');
    expect(res.status).toBe(200);
    expect(res.body.names.map((n: any) => n.name)).toEqual(['Белова Соня', 'Ахметов Тимур']);
    expect(res.body.skipped).toBe(1); // запятая внутри имени — не похоже на имя
  });

  it('CSV в UTF-8 с BOM и заголовком', async () => {
    const t = await setupTeacher([]);
    const csv = '﻿ученик,класс\nЛев Крылов,5А\nМира Седова,5А\n';
    const res = await upload(t.group.id, t.cookie, new TextEncoder().encode(csv), 'list.csv');
    expect(res.body.names.map((n: any) => n.name)).toEqual(['Лев Крылов', 'Мира Седова']);
  });

  it('предпросмотр ничего не создаёт; ошибки форматов понятные', async () => {
    const t = await setupTeacher([]);
    const empty = await upload(t.group.id, t.cookie, new TextEncoder().encode('123;456\n'), 'nums.csv');
    expect(empty.status).toBe(422);
    const xls = await upload(t.group.id, t.cookie, new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), 'old.xls');
    expect(xls.status).toBe(415);
    const broken = await upload(t.group.id, t.cookie, new TextEncoder().encode('not a zip'), 'broken.xlsx');
    expect(broken.status).toBe(422);
    const group = await call('GET', `/api/teacher/groups/${t.group.id}`, { cookie: t.cookie });
    expect(group.body.students).toHaveLength(0);
  });

  it('чужой преподаватель и ученик не могут загружать', async () => {
    const a = await setupTeacher(['А Один']);
    const b = await setupTeacher([]);
    const data = new TextEncoder().encode('Лев Крылов\n');
    expect((await upload(a.group.id, b.cookie, data, 'x.csv')).status).toBe(404);
    expect((await upload(a.group.id, await a.studentCookie(0), data, 'x.csv')).status).toBe(403);
  });
});
