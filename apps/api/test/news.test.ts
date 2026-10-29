import { describe, expect, it } from 'vitest';
import { HERO_PARTS } from '@heroes/shared';
import { prisma } from '../src/db.js';
import { call, setupTeacher } from './helpers.js';

const give = (studentId: string, value: number) =>
  prisma.pointEvent.create({ data: { studentId, reasonName: 'Тест', emoji: '⭐', value } });

describe('новый уровень и новые детали', () => {
  it('без баллов новостей нет', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const cookie = await t.studentCookie(0);
    const news = await call('GET', '/api/student/news', { cookie });
    expect(news.status).toBe(200);
    expect(news.body).toMatchObject({ level: 1, levelUp: null, newPartIds: [] });
  });

  it('после повышения уровня — поздравление и список открывшихся деталей', async () => {
    const t = await setupTeacher(['Ученик Один']);
    await give(t.students[0].id, 25); // 3 уровень
    const cookie = await t.studentCookie(0);
    const news = await call('GET', '/api/student/news', { cookie });
    expect(news.body.level).toBe(3);
    expect(news.body.levelUp).toEqual({ from: 1, to: 3 });
    const expected = HERO_PARTS.filter((p) => !p.premium && p.requiredLevel > 1 && p.requiredLevel <= 3).map((p) => p.id);
    expect([...news.body.newPartIds].sort()).toEqual([...expected].sort());
  });

  it('поздравление и детали отмечаются просмотренными раздельно', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const sid = t.students[0].id;
    await give(sid, 10); // 2 уровень
    const cookie = await t.studentCookie(0);

    const afterLevel = await call('POST', '/api/student/news/seen', { cookie, body: { kind: 'level' } });
    expect(afterLevel.body.levelUp).toBeNull();
    expect(afterLevel.body.newPartIds.length).toBeGreaterThan(0);

    const afterParts = await call('POST', '/api/student/news/seen', { cookie, body: { kind: 'parts' } });
    expect(afterParts.body.newPartIds).toEqual([]);

    // Следующий уровень снова даёт новости, но только о новых деталях
    await give(sid, 15); // 25 → 3 уровень
    const next = await call('GET', '/api/student/news', { cookie });
    expect(next.body.levelUp).toEqual({ from: 2, to: 3 });
    expect(next.body.newPartIds.every((id: string) => HERO_PARTS.find((p) => p.id === id)!.requiredLevel === 3)).toBe(true);
  });

  it('отметка не откатывается, если баллы отменили', async () => {
    const t = await setupTeacher(['Ученик Один']);
    const sid = t.students[0].id;
    const ev = await give(sid, 10);
    const cookie = await t.studentCookie(0);
    await call('POST', '/api/student/news/seen', { cookie, body: { kind: 'level' } });
    await prisma.pointEvent.delete({ where: { id: ev.id } });
    await call('POST', '/api/student/news/seen', { cookie, body: { kind: 'level' } });
    const s = await prisma.student.findUniqueOrThrow({ where: { id: sid } });
    expect(s.celebratedLevel).toBe(2);
  });

  it('преподаватель не может трогать новости ученика, а ученик не может подставить уровень', async () => {
    const t = await setupTeacher(['Ученик Один']);
    expect((await call('GET', '/api/student/news', { cookie: t.cookie })).status).toBe(403);
    const cookie = await t.studentCookie(0);
    const bad = await call('POST', '/api/student/news/seen', { cookie, body: { kind: 'level', level: 10 } });
    expect(bad.status).toBe(200);
    const s = await prisma.student.findUniqueOrThrow({ where: { id: t.students[0].id } });
    expect(s.celebratedLevel).toBe(1);
    const wrong = await call('POST', '/api/student/news/seen', { cookie, body: { kind: 'everything' } });
    expect(wrong.status).toBe(400);
  });
});
