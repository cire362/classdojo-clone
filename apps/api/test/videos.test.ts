import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { stripVideoMetadata } from '../src/modules/files/video.js';
import { call, login, setupTeacher } from './helpers.js';
import { picture, sizeOf } from './images.js';

/**
 * Ролики сняты AVFoundation скриптом fixtures/make-video.swift: H.264, 1 секунда, геопозиция,
 * модель телефона и дата. В MP4 они лежат в moov/udta (loci, date), в MOV — в moov/meta (keys, ilst).
 * После очистки AVFoundation открывает оба ролика и не видит ни одной записи метаданных.
 */
const MP4 = readFileSync(new URL('./fixtures/geo.mp4', import.meta.url));
const MOV = readFileSync(new URL('./fixtures/geo.mov', import.meta.url));
const SECRETS = ['55.7539', 'SECRET-PHONE', '2026-11-01', 'loci', 'keys', 'ilst'];
const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;

function post(t: Teacher, parts: { video?: Uint8Array; poster?: Uint8Array; photos?: Uint8Array[]; videos?: Uint8Array[] }) {
  const data = new FormData();
  data.append('text', 'Выступление класса');
  for (const v of parts.videos ?? (parts.video ? [parts.video] : [])) data.append('video', new File([v as BlobPart], 'IMG_0042.MOV'));
  if (parts.poster) data.append('poster', new File([parts.poster as BlobPart], 'poster.jpg'));
  for (const p of parts.photos ?? []) data.append('photo', new File([p as BlobPart], 'p.jpg'));
  return call('POST', `/api/teacher/groups/${t.group.id}/feed`, { cookie: t.cookie, raw: data });
}

it('исходные ролики действительно несут метаданные', () => {
  for (const s of ['SECRET-PHONE', '55.7539', 'ilst']) expect(text(MOV)).toContain(s);
  for (const s of ['loci', '2026-11-01']) expect(text(MP4)).toContain(s);
});

it('очистка убирает метаданные, не меняя размер и кадры', () => {
  for (const original of [MP4, MOV]) {
    const clean = stripVideoMetadata(original);
    expect(clean.length).toBe(original.length);
    for (const s of SECRETS) expect(text(clean)).not.toContain(s);
    // Кадры (mdat) не тронуты: те же байты на тех же местах
    const mdat = text(original).indexOf('mdat');
    expect(Buffer.from(clean.subarray(mdat, mdat + 2000)).equals(original.subarray(mdat, mdat + 2000))).toBe(true);
    expect(text(clean)).toContain('moov');
  }
});

it('битые и чужие файлы не принимаются за видео', () => {
  const head = MP4.subarray(0, 40);
  expect(() => stripVideoMetadata(head)).toThrow();
  const lying = Buffer.from(MP4);
  lying.writeUInt32BE(0xffffff, 0);
  expect(() => stripVideoMetadata(lying)).toThrow();
  const noMovie = Buffer.from(MP4.subarray(0, text(MP4).indexOf('moov') - 4));
  expect(() => stripVideoMetadata(noMovie)).toThrow();
});

it('видео в записи: очищено, с обложкой, отдаётся частями для перемотки', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const poster = await picture(320, 240, 'image/jpeg');
  const photo = await picture(30, 20, 'image/jpeg');
  const res = await post(t, { video: MOV, poster, photos: [photo] });
  expect(res.status).toBe(201);
  expect(res.body.media.map((m: { kind: string }) => m.kind)).toEqual(['video', 'photo']);
  const { id } = res.body.media[0];

  const student = await t.studentCookie(0);
  const whole = await call('GET', `/api/files/${id}`, { cookie: student });
  expect(whole.status).toBe(200);
  expect(whole.headers.get('content-type')).toBe('video/mp4');
  expect(whole.headers.get('accept-ranges')).toBe('bytes');
  expect(whole.headers.get('content-disposition')).toMatch(/^inline;/);
  const bytes = new Uint8Array(whole.body as ArrayBuffer);
  expect(bytes.length).toBe(MOV.length);
  for (const s of SECRETS) expect(text(bytes)).not.toContain(s);

  const part = await call('GET', `/api/files/${id}`, { cookie: student, headers: { range: 'bytes=100-199' } });
  expect(part.status).toBe(206);
  expect(part.headers.get('content-range')).toBe(`bytes 100-199/${MOV.length}`);
  expect(Buffer.from(part.body as ArrayBuffer).equals(Buffer.from(bytes.subarray(100, 200)))).toBe(true);
  const tail = await call('GET', `/api/files/${id}`, { cookie: student, headers: { range: 'bytes=-10' } });
  expect(Buffer.from(tail.body as ArrayBuffer).equals(Buffer.from(bytes.subarray(-10)))).toBe(true);
  const open = await call('GET', `/api/files/${id}`, { cookie: student, headers: { range: `bytes=${MOV.length - 5}-` } });
  expect(open.headers.get('content-range')).toBe(`bytes ${MOV.length - 5}-${MOV.length - 1}/${MOV.length}`);
  const beyond = await call('GET', `/api/files/${id}`, { cookie: student, headers: { range: `bytes=${MOV.length}-` } });
  expect(beyond.status).toBe(416);
  expect(beyond.headers.get('content-range')).toBe(`bytes */${MOV.length}`);
  expect((await call('GET', `/api/files/${id}`, { cookie: student, headers: { range: 'items=0-1' } })).status).toBe(200);

  const cover = await call('GET', `/api/files/${id}?size=preview`, { cookie: student });
  expect(cover.headers.get('content-type')).toBe('image/jpeg');
  expect(await sizeOf(cover.body as ArrayBuffer)).toEqual({ width: 320, height: 240 });
});

it('видео без обложки: превью отвечает 404, а не роликом', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const { id } = (await post(t, { video: MP4 })).body.media[0];
  expect((await call('GET', `/api/files/${id}?size=preview`, { cookie: t.cookie })).status).toBe(404);
  expect((await call('GET', `/api/files/${id}`, { cookie: t.cookie })).status).toBe(200);
});

it('ограничения: одно видео, обложка только картинкой, видео не через загрузку документов', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  expect((await post(t, { videos: [MP4, MOV] })).status).toBe(400);
  expect((await post(t, { photos: [MP4, MOV] })).status).toBe(400);
  expect((await post(t, { video: MP4, poster: MP4 })).status).toBe(415);
  expect((await post(t, { video: Buffer.from('просто текст') })).status).toBe(415);
  const data = new FormData();
  data.append('file', new File([MP4], 'ролик.mp4'));
  expect((await call('POST', `/api/teacher/groups/${t.group.id}/files`, { cookie: t.cookie, raw: data })).status).toBe(415);
  const parent = await login(
    ...(await (async () => {
      const issued = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
      return [issued.login, issued.password] as [string, string];
    })()),
  );
  const { id } = (await post(t, { video: MP4 })).body.media[0];
  expect((await call('GET', `/api/files/${id}`, { cookie: parent, headers: { range: 'bytes=0-9' } })).status).toBe(206);
  const other = await setupTeacher(['Петя']);
  expect((await call('GET', `/api/files/${id}`, { cookie: other.cookie, headers: { range: 'bytes=0-9' } })).status).toBe(404);
});
