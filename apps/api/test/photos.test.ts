import { expect, it } from 'vitest';
import { call, setupTeacher } from './helpers.js';
import { picture, pngBomb, sizeOf, withExif, withPngText } from './images.js';

type Teacher = Awaited<ReturnType<typeof setupTeacher>>;
const SECRET = 'GPS 55.7539 37.6208 Маша дома';

async function upload(t: Teacher, bytes: Uint8Array, name: string) {
  const data = new FormData();
  data.append('file', new File([bytes as BlobPart], name));
  return call('POST', `/api/teacher/groups/${t.group.id}/files`, { cookie: t.cookie, raw: data });
}

async function download(t: Teacher, id: string, preview = false) {
  const res = await call('GET', `/api/files/${id}${preview ? '?size=preview' : ''}`, { cookie: t.cookie });
  expect(res.status).toBe(200);
  return { bytes: new Uint8Array(res.body as ArrayBuffer), headers: res.headers };
}

const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1') + Buffer.from(bytes).toString('utf8');

it('из JPEG пропадают EXIF и комментарий, поворот из EXIF применяется', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const original = withExif(await picture(40, 20, 'image/jpeg'), 6, SECRET);
  expect(text(original)).toContain(SECRET);
  const up = await upload(t, original, 'IMG_0001.jpg');
  expect(up.status).toBe(201);
  expect(up.body.mime).toBe('image/jpeg');
  const { bytes } = await download(t, up.body.id);
  expect(text(bytes)).not.toContain(SECRET);
  expect(text(bytes)).not.toContain('Exif');
  expect(await sizeOf(bytes)).toEqual({ width: 20, height: 40 });
});

it('из PNG пропадают текстовые блоки, формат сохраняется', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const original = withPngText(await picture(8, 8, 'image/png'), SECRET);
  expect(await sizeOf(original)).toEqual({ width: 8, height: 8 });
  const up = await upload(t, original, 'скрин.png');
  const { bytes, headers } = await download(t, up.body.id);
  expect(headers.get('content-type')).toBe('image/png');
  expect(text(bytes)).not.toContain(SECRET);
  expect(text(bytes)).not.toContain('tEXt');
});

it('большое фото уменьшается до 2048 точек, превью до 480', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const up = await upload(t, await picture(3000, 1500, 'image/jpeg'), 'большое.jpg');
  const full = await download(t, up.body.id);
  expect(await sizeOf(full.bytes)).toEqual({ width: 2048, height: 1024 });
  expect(up.body.size).toBe(full.bytes.length);
  const preview = await download(t, up.body.id, true);
  expect(await sizeOf(preview.bytes)).toEqual({ width: 480, height: 240 });
  expect(preview.headers.get('content-length')).toBe(String(preview.bytes.length));
  expect(preview.headers.get('etag')).toBe(`"${up.body.id}-preview"`);
  expect(preview.bytes.length).toBeLessThan(full.bytes.length);
});

it('маленькое фото не растягивается', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const up = await upload(t, await picture(100, 60, 'image/jpeg'), 'мал.jpg');
  expect(await sizeOf((await download(t, up.body.id)).bytes)).toEqual({ width: 100, height: 60 });
  expect(await sizeOf((await download(t, up.body.id, true)).bytes)).toEqual({ width: 100, height: 60 });
});

it('у PDF нет превью: отдаётся сам файл без изменений', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const pdf = new Uint8Array(Buffer.from('%PDF-1.7 работа'));
  const up = await upload(t, pdf, 'работа.pdf');
  expect((await download(t, up.body.id, true)).bytes).toEqual(pdf);
});

it('распаковочная бомба отклоняется по заголовку, битое фото — понятной ошибкой', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const bomb = await upload(t, pngBomb(20_000, 20_000), 'бомба.png');
  expect(bomb.status).toBe(413);
  expect(bomb.body.error).toMatch(/30 мегапикселей/);
  expect((await upload(t, pngBomb(0, 10), 'ноль.png')).status).toBe(415);
  const broken = Buffer.concat([(await picture(10, 10, 'image/jpeg')).subarray(0, 40), Buffer.alloc(200, 7)]);
  expect((await upload(t, broken, 'битое.jpg')).status).toBe(415);
  expect((await upload(t, new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 2]), 'пусто.jpg')).status).toBe(415);
  expect((await upload(t, await picture(10, 10, 'image/jpeg'), 'после.jpg')).status).toBe(201);
});

it('несколько фото одновременно обрабатываются по очереди и все сохраняются', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const photo = await picture(1200, 900, 'image/jpeg');
  const results = await Promise.all(Array.from({ length: 4 }, (_, i) => upload(t, photo, `${i}.jpg`)));
  expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201]);
});
