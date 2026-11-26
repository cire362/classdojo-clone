import { expect, test, type Page } from '@playwright/test';
import { TEACHER, loginUi, tempGroup, uniq } from './helpers';

/** Страницы должны помещаться по ширине и заканчиваться у нижней границы содержимого */
async function pageFits(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect(page).toHaveURL(url => url.pathname === path);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('status', { name: 'Загрузка' })).toHaveCount(0);
  await expectFits(page);
}

async function expectFits(page: Page) {
  const { scroll, width, height, contentBottom } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
    height: document.documentElement.scrollHeight,
    contentBottom: Math.max(document.documentElement.clientHeight, document.querySelector('main')!.getBoundingClientRect().bottom + scrollY),
  }));
  expect(scroll, `${page.url()}: ширина ${scroll} > ${width}`).toBeLessThanOrEqual(width + 1);
  expect(height, `${page.url()}: лишняя область под содержимым`).toBeLessThanOrEqual(Math.ceil(contentBottom) + 2);
}

test('страницы преподавателя и ученика помещаются на телефонах и планшетах', async ({ page, request, browser }) => {
  test.setTimeout(180_000);
  const g = await tempGroup(request, uniq('E2E телефон'), ['Мобильный Первый', 'Мобильный Второй', 'Мобильный Третий']);
  try {
    await loginUi(page, TEACHER.login, TEACHER.password);
    await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    const groupTabs = ['attendance', 'students', 'reasons', 'stats', 'rewards', 'feed', 'calendar', 'works', 'assignments', 'world', 'print'];
    const paths = [
      '/', '/messages', '/settings', '/materials', '/reward-requests', '/school', `/s/${g.credentials[0].id}`,
      `/s/${g.credentials[0].id}/hero`,
      `/g/${g.id}`, ...groupTabs.map(tab => `/g/${g.id}/${tab}`),
    ];
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 812 });
      for (const path of paths) await pageFits(page, path);
    }
    const s = g.credentials[0];
    const student = await (await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 375, height: 812 } })).newPage();
    await loginUi(student, s.login, s.password);
    await expect(student.getByRole('link', { name: 'Собрать героя' })).toBeVisible();
    const studentPaths = ['/', '/hero', '/shop', '/feed', '/calendar', '/works', '/assignments', '/world', '/notifications'];
    for (const width of [320, 375, 768, 1024]) {
      await student.setViewportSize({ width, height: 812 });
      for (const path of studentPaths) await pageFits(student, path);
    }
    await student.context().close();
  } finally {
    await g.remove();
  }
});

test('владелец удаляет класс из шапки после подтверждения названия', async ({ page, request }) => {
  const name = uniq('E2E удаление');
  const group = await tempGroup(request, name);
  try {
    await loginUi(page, TEACHER.login, TEACHER.password);
    await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    await page.goto(`/g/${group.id}`);
    await page.getByRole('button', { name: /^Удалить (класс|группу)$/ }).click();
    const dialog = page.getByRole('dialog');
    const confirm = dialog.getByRole('button', { name: /^Удалить (класс|группу)$/ });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole('textbox').fill(name);
    await confirm.click();
    await expect(page).toHaveURL('/');
    expect((await request.get(`/api/teacher/groups/${group.id}`)).ok()).toBe(false);
  } finally {
    await group.remove();
  }
});


test('кабинеты родителя, администрации и сети помещаются на узких экранах', async ({ page }) => {
  test.setTimeout(120_000);
  for (const [login, password, marker] of [
    ['parent', process.env.SEED_PARENT_PASSWORD ?? 'parent12345', 'Профиль'],
    ['admin', process.env.SEED_ADMIN_PASSWORD ?? 'admin12345', 'Преподаватели'],
    ['college', process.env.SEED_COLLEGE_PASSWORD ?? 'college12345', 'Преподаватели'],
    ['network', process.env.SEED_NETWORK_PASSWORD ?? 'network12345', 'Демо-сеть учреждений'],
  ]) {
    await loginUi(page, login, password);
    await expect(page.getByText(marker, { exact: true }).first()).toBeVisible();
    const nav = page.getByRole('main').getByRole('navigation', { name: 'Разделы' });
    const tabs = await nav.getByRole('button').all();
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 812 });
      await expectFits(page);
      for (const tab of tabs) {
        await tab.click();
        await page.waitForLoadState('networkidle');
        await expectFits(page);
      }
    }
    if (login === 'parent') {
      for (const path of ['/school', '/school-messages']) await pageFits(page, path);
    }
    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page).toHaveURL(/login/);
  }
});


test('длинные названия дисциплин и дополнительные разделы колледжа помещаются на телефоне', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await loginUi(page, 'kurator', TEACHER.password);
  await page.getByRole('link', { name: /ИС-21/ }).click();
  await expect(page.getByRole('combobox', { name: 'Дисциплина' })).toBeVisible();
  await expectFits(page);
  await page.getByRole('button', { name: 'Выйти' }).click();
  await loginUi(page, 'anastasiya.b', process.env.SEED_STUDENT_PASSWORD ?? 'hero12345');
  await expect(page.getByRole('link', { name: 'Сообщения', exact: true })).toBeVisible();
  for (const path of ['/', '/chat', '/school', '/school-messages']) await pageFits(page, path);
});


test('публичные формы входа помещаются на телефоне', async ({ page }) => {
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    for (const path of ['/login', '/q', '/join', '/invite', '/school-join']) await pageFits(page, path);
  }
});


test('сверка посещаемости не создаёт пустую область под списком', async ({ page, request }) => {
  const group = await tempGroup(request, uniq('E2E отметка'), ['Первый ученик', 'Второй ученик']);
  try {
    await loginUi(page, TEACHER.login, TEACHER.password);
    await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    await page.setViewportSize({ width: 375, height: 1000 });
    await page.goto(`/g/${group.id}/attendance`);
    await page.getByRole('button', { name: 'Без фото' }).click();
    const save = page.getByRole('button', { name: 'Сохранить', exact: true });
    const last = page.locator('ul.card label').last();
    await expect(save).toBeVisible();
    await expect(last).toBeVisible();
    const saveBox = (await save.boundingBox())!;
    const lastBox = (await last.boundingBox())!;
    expect(saveBox.y - (lastBox.y + lastBox.height)).toBeLessThanOrEqual(48);
    await page.setViewportSize({ width: 375, height: 420 });
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    await expectFits(page);
  } finally {
    await group.remove();
  }
});


test('фото и рамки подсчёта помещаются на экране iPhone', async ({ page, request }) => {
  const group = await tempGroup(request, uniq('E2E фото'), ['Первый ученик', 'Второй ученик']);
  try {
    await loginUi(page, TEACHER.login, TEACHER.password);
    await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto(`/g/${group.id}/attendance`);
    for (const [width, height] of [[1600, 900], [600, 1600]]) {
      const bytes = await page.evaluate(({ width, height }) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ddd';
        ctx.fillRect(0, 0, width, height);
        return canvas.toDataURL('image/jpeg').split(',')[1];
      }, { width, height });
      await page.route('**/attendance/detect', route => route.fulfill({
        json: { width, height, count: 1, elapsedMs: 10, boxes: [{ x: 100, y: 100, w: 200, h: 300, score: 0.9 }] },
      }));
      await page.getByLabel('Выбрать фото группы').setInputFiles({
        name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bytes, 'base64'),
      });
      const photo = page.getByRole('img', { name: 'Фото группы' });
      await expect(photo).toBeVisible();
      await expectFits(page);
      const box = (await photo.boundingBox())!;
      expect(box.width).toBeLessThanOrEqual(393);
      expect(box.height).toBeLessThanOrEqual(852 * 0.65 + 1);
      expect(box.width / box.height).toBeCloseTo(width / height, 2);
      await page.getByRole('button', { name: 'Отмена' }).click();
      await page.unroute('**/attendance/detect');
    }
  } finally {
    await group.remove();
  }
});


test('настройки группы прокручиваются внутри окна на телефоне', async ({ page, request }) => {
  const group = await tempGroup(request, uniq('E2E окно'));
  try {
    await loginUi(page, TEACHER.login, TEACHER.password);
    await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(`/g/${group.id}/students`);
    await page.getByRole('button', { name: 'Настройки группы' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (const [width, height] of [[393, 852], [320, 568]]) {
      await page.setViewportSize({ width, height });
      for (const item of [dialog, dialog.getByLabel('Название', { exact: true }), dialog.getByRole('button', { name: 'Закрыть' })]) {
        const box = (await item.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      }
    }
    const body = dialog.locator('div.overflow-y-auto').first();
    expect(await body.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    const before = await page.evaluate(() => scrollY);
    await body.evaluate(el => el.scrollTo(0, el.scrollHeight));
    expect(await body.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => scrollY)).toBe(before);
    await expect(dialog.getByRole('button', { name: 'Закрыть' })).toBeInViewport();
  } finally {
    await group.remove();
  }
});
