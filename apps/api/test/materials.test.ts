import { afterEach, expect, it, vi } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { env } from '../src/platform/env.js';
import { call, setupTeacher } from './helpers.js';

const PDF = new TextEncoder().encode('%PDF-1.4\n% методичка\n%%EOF');
// Минимальный «документ Word»: zip с [Content_Types].xml и папкой word/
const DOCX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode('[Content_Types].xml word/document.xml')]);

const upload = (cookie: string, bytes: Uint8Array<ArrayBuffer>, name: string, fields: Record<string, string> = {}) => {
  const form = new FormData();
  form.append('file', new File([bytes], name));
  for (const [k, v] of Object.entries({ title: '', description: '', shared: 'true', ...fields })) form.append(k, v);
  return call('POST', '/api/teacher/materials', { cookie, raw: form });
};

afterEach(() => {
  vi.restoreAllMocks();
  env.converterUrl = '';
});

it('PDF открывается на странице, коллеги учреждения видят открытые методички, чужое учреждение — нет', async () => {
  const school = await prisma.school.create({ data: { name: 'Гимназия' } });
  const author = await setupTeacher([], school.id);
  const colleague = await setupTeacher([], school.id);
  const stranger = await setupTeacher([]);
  const created = await upload(author.cookie, PDF, 'Дроби 5 класс.pdf', { description: 'Конспект урока' });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({ title: 'Дроби 5 класс', kind: 'pdf', viewable: true, mine: true, shared: true });
  const id = created.body.id;
  const hidden = (await upload(author.cookie, PDF, 'черновик.pdf', { title: 'Черновик', shared: 'false' })).body.id;

  const view = await call('GET', `/api/teacher/materials/${id}/view`, { cookie: colleague.cookie });
  expect(view.status).toBe(200);
  expect(view.headers.get('content-type')).toBe('application/pdf');
  expect(view.headers.get('content-disposition')).toMatch(/^inline;/);
  const file = await call('GET', `/api/teacher/materials/${id}/file`, { cookie: colleague.cookie });
  expect(file.headers.get('content-disposition')).toMatch(/^attachment;/);

  const list = (await call('GET', '/api/teacher/materials', { cookie: colleague.cookie })).body;
  expect(list.map((m: { title: string; mine: boolean }) => [m.title, m.mine])).toEqual([['Дроби 5 класс', false]]);
  expect((await call('GET', `/api/teacher/materials/${hidden}/view`, { cookie: colleague.cookie })).status).toBe(404);
  expect((await call('GET', `/api/teacher/materials/${id}/view`, { cookie: stranger.cookie })).status).toBe(404);
  expect((await call('GET', '/api/teacher/materials', { cookie: stranger.cookie })).body).toEqual([]);

  // Менять и удалять может только автор
  expect((await call('DELETE', `/api/teacher/materials/${id}`, { cookie: colleague.cookie })).status).toBe(403);
  const renamed = await call('PATCH', `/api/teacher/materials/${id}`, {
    cookie: author.cookie, body: { title: 'Дроби', description: '', shared: false },
  });
  expect(renamed.body).toMatchObject({ title: 'Дроби', shared: false });
  expect((await call('GET', `/api/teacher/materials/${id}/view`, { cookie: colleague.cookie })).status).toBe(404);
  expect((await call('DELETE', `/api/teacher/materials/${id}`, { cookie: author.cookie })).status).toBe(200);
  expect(await prisma.material.count({ where: { id } })).toBe(0);
});

it('документ Word показывается через PDF-копию; без сервиса просмотра — скачивание и повторная попытка позже', async () => {
  const t = await setupTeacher([]);
  const offline = (await upload(t.cookie, DOCX, 'План.docx')).body;
  expect(offline).toMatchObject({ kind: 'word', viewable: false });
  expect((await call('GET', `/api/teacher/materials/${offline.id}/view`, { cookie: t.cookie })).status).toBe(409);
  expect((await call('GET', `/api/teacher/materials/${offline.id}/file`, { cookie: t.cookie })).status).toBe(200);

  // Сервис просмотра заработал: копия делается при первом просмотре
  env.converterUrl = 'http://converter.test';
  const convert = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    expect(String(input)).toBe('http://converter.test/convert');
    expect((init?.headers as Record<string, string>)['X-Extension']).toBe('docx');
    return new Response(PDF, { headers: { 'Content-Type': 'application/pdf' } });
  });
  const view = await call('GET', `/api/teacher/materials/${offline.id}/view`, { cookie: t.cookie });
  expect(view.headers.get('content-type')).toBe('application/pdf');
  expect(view.headers.get('content-disposition')).toContain(encodeURIComponent('План.pdf'));
  const fresh = (await upload(t.cookie, DOCX, 'Ещё.docx')).body;
  expect(fresh.viewable).toBe(true);
  expect(convert).toHaveBeenCalledTimes(2);
});

it('HTML, исполняемые файлы и подделки под документ не принимаются', async () => {
  const t = await setupTeacher([]);
  const text = new TextEncoder().encode('<script>alert(1)</script>');
  expect((await upload(t.cookie, text, 'страница.html')).status).toBe(415);
  expect((await upload(t.cookie, text, 'подделка.pdf')).status).toBe(415);
  expect((await upload(t.cookie, new Uint8Array([0x4d, 0x5a, 0x90, 0x00]), 'setup.exe')).status).toBe(415);
  const notes = await upload(t.cookie, new TextEncoder().encode('План урока: дроби'), 'заметки.txt');
  expect(notes.body).toMatchObject({ kind: 'text', viewable: true });
  const view = await call('GET', `/api/teacher/materials/${notes.body.id}/view`, { cookie: t.cookie });
  expect(view.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  expect(view.headers.get('content-security-policy')).toContain("default-src 'none'");
});
