import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginApi, loginUi, tempGroup, uniq } from './helpers';

const H = { 'x-heroes-client': '1' };

for (const colorScheme of ['light', 'dark'] as const) {
  test(`задания в кабинете родителя: состояние, комментарий и принятый ответ (${colorScheme})`, async ({ browser, request }) => {
    const g = await tempGroup(request, uniq('E2E задания родителя'), ['Лиза Ершова']);
    try {
      await loginApi(request);
      const parent = await (await request.post(`/api/teacher/students/${g.credentials[0].id}/parents`, { headers: H })).json();
      const give = async (title: string) =>
        (await (await request.post(`/api/teacher/groups/${g.id}/assignments`, { headers: H, multipart: { title, points: '2' } })).json())
          .find((a: { title: string }) => a.title === title).id as string;
      const poem = await give('Выучить стих');
      await give('Прочитать рассказ');

      const pupil = await browser.newContext({ baseURL: test.info().project.use.baseURL });
      await loginApi(pupil.request, g.credentials[0].login, g.credentials[0].password);
      await pupil.request.post(`/api/student/assignments/${poem}/answers`, { headers: H, multipart: { text: 'Выучила наизусть' } });
      await pupil.close();
      const detail = await (await request.get(`/api/teacher/groups/${g.id}/assignments/${poem}`)).json();
      await request.put(`/api/teacher/groups/${g.id}/assignments/${poem}/answers/${detail.answers[0].work.id}`, {
        headers: H, data: { status: 'APPROVED', comment: 'Прекрасно!' },
      });

      const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme, reducedMotion: 'reduce' });
      const home = await context.newPage();
      await home.setViewportSize({ width: 375, height: 812 });
      await loginUi(home, parent.login, parent.password);
      await home.getByRole('button', { name: 'Задания', exact: true }).click();
      const list = home.getByRole('list', { name: 'Задания ребёнка' });
      const accepted = list.getByRole('listitem').filter({ has: home.getByRole('heading', { name: 'Выучить стих', level: 2 }) });
      await expect(accepted.getByText('Принято')).toBeVisible();
      await expect(accepted.getByText('Прекрасно!')).toBeVisible();
      await expect(accepted.getByText('Выучила наизусть')).toBeVisible();
      await expect(list.getByRole('listitem').filter({ hasText: 'Прочитать рассказ' }).first().getByText('Не сдано')).toBeVisible();
      expect(await home.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await home.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
      const { violations } = await new AxeBuilder({ page: home }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
      expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      await home.screenshot({ path: test.info().outputPath(`parent-assignments-${colorScheme}.png`), fullPage: true });
      await context.close();
    } finally {
      await g.remove();
    }
  });
}
