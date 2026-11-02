import { expect, test } from '@playwright/test';
import { loginApi, tempGroup, uniq } from './helpers';

const H = { 'x-heroes-client': '1' };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const file = (buffer: Buffer, name = 'снимок.png') => ({ multipart: { file: { name, mimeType: 'image/png', buffer } }, headers: H });

test('файл проходит через nginx в том и отдаётся только участникам группы', async ({ request, browser }) => {
  const g = await tempGroup(request, uniq('E2E файлы'), ['Файл Первый']);
  const other = await tempGroup(request, uniq('E2E чужая'), ['Файл Второй']);
  try {
    await loginApi(request);
    const up = await request.post(`/api/teacher/groups/${g.id}/files`, file(PNG));
    expect(up.status()).toBe(201);
    const { id } = await up.json();

    const fresh = async () => {
      const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
      return context.request;
    };
    const anonymous = await fresh();
    expect((await anonymous.get(`/api/files/${id}`)).status()).toBe(401);

    const pupil = await fresh();
    await pupil.post('/api/auth/login', { headers: H, data: { login: g.credentials[0].login, password: g.credentials[0].password } });
    const res = await pupil.get(`/api/files/${id}`);
    expect(res.status()).toBe(200);
    expect(Buffer.from(await res.body()).equals(PNG)).toBe(true);
    expect(res.headers()['content-type']).toBe('image/png');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');

    const stranger = await fresh();
    await stranger.post('/api/auth/login', { headers: H, data: { login: other.credentials[0].login, password: other.credentials[0].password } });
    expect((await stranger.get(`/api/files/${id}`)).status()).toBe(404);

    // Самый большой разрешённый файл проходит ограничение nginx, следующий байт отклоняет API
    const biggest = Buffer.alloc(10 * 1024 * 1024);
    PNG.copy(biggest);
    expect((await request.post(`/api/teacher/groups/${g.id}/files`, file(biggest))).status()).toBe(201);
    expect((await request.post(`/api/teacher/groups/${g.id}/files`, file(Buffer.concat([biggest, Buffer.alloc(1)])))).status()).toBe(413);

    expect((await request.delete(`/api/teacher/files/${id}`, { headers: H })).status()).toBe(200);
    expect((await pupil.get(`/api/files/${id}`)).status()).toBe(404);
  } finally {
    await g.remove();
    await other.remove();
  }
});
