import { expect, test } from '@playwright/test';
import { loginUi, TEACHER, tempGroup, uniq } from './helpers';

const H = { 'x-heroes-client': '1' };

test('награда подгруппе попадает каждому участнику и отменяется целиком', async ({ page, request }) => {
  const g = await tempGroup(request, uniq('E2E награда подгруппе'), ['Анна', 'Борис', 'Вера', 'Глеб']);
  try {
    expect((await request.post(`/api/teacher/groups/${g.id}/reasons`, {
      headers: H, data: { name: 'Победа в проекте', value: 3, emoji: 'star' },
    })).ok()).toBeTruthy();
    await loginUi(page, TEACHER.login, TEACHER.password);
    await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();
    await page.goto(`/g/${g.id}`);
    await page.getByRole('button', { name: 'Пары и группы', exact: true }).click();
    await page.getByRole('button', { name: 'Сформировать', exact: true }).click();
    const distribution = page.getByRole('list', { name: 'Случайное распределение' });
    const first = distribution.locator(':scope > li').first();
    const winners = await first.getByRole('list').getByRole('listitem').allTextContents();
    await first.getByRole('button', { name: 'Наградить участников' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Победа в проекте/ }).click();
    await expect(page.getByText(/2 ученика: \+3/)).toBeVisible();
    for (const s of g.credentials) {
      const p = await (await request.get(`/api/teacher/students/${s.id}/profile`)).json();
      expect(p.points.total.earned).toBe(winners.includes(s.name) ? 3 : 0);
      if (winners.includes(s.name)) expect(p.history[0].reasonName).toBe('Победа в проекте');
    }
    await page.getByRole('button', { name: 'Отменить', exact: true }).click();
    await expect(page.getByText('Отменено', { exact: true })).toBeVisible();
    const after = await (await request.get(`/api/teacher/groups/${g.id}`)).json();
    expect(after.teams).toEqual([]);
    expect(after.students.every((s: { totalEarned: number }) => s.totalEarned === 0)).toBe(true);
  } finally { await g.remove(); }
});
