import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const TEACHER = {
  login: process.env.E2E_TEACHER_LOGIN ?? 'teacher',
  password: process.env.E2E_TEACHER_PASSWORD ?? 'teacher123',
};

export const IMAGES = new URL('../../services/detector/tests/images/', import.meta.url).pathname;

const H = { 'x-heroes-client': '1' };

export async function loginUi(page: Page, login: string, password: string) {
  await page.goto('/login');
  await page.fill('#login', login);
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

export async function loginApi(request: APIRequestContext, login = TEACHER.login, password = TEACHER.password) {
  const r = await request.post('/api/auth/login', { data: { login, password }, headers: H });
  expect(r.ok()).toBeTruthy();
}

/** Временная группа с учениками; удаляется в конце теста — данные стенда не засоряются */
export async function tempGroup(request: APIRequestContext, name: string, students: string[] = []) {
  await loginApi(request);
  const group = await (await request.post('/api/teacher/groups', { data: { name }, headers: H })).json();
  let credentials: { id: string; name: string; login: string; password: string }[] = [];
  if (students.length) {
    credentials = (await (await request.post(`/api/teacher/groups/${group.id}/students`, { data: { names: students }, headers: H })).json())
      .credentials;
  }
  return {
    id: group.id as string,
    credentials,
    remove: () => request.delete(`/api/teacher/groups/${group.id}`, { headers: H }),
  };
}

export const uniq = (prefix: string) => `${prefix} ${Date.now().toString(36)}`;

/**
 * Ждёт конца анимаций появления перед проверкой доступности и скриншотом. Бесконечные анимации
 * (дыхание живого героя, таймеры) не ждём: они не заканчиваются
 */
export async function animationsDone(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}
