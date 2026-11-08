import { describe, expect, it } from 'vitest';
import { DEFAULT_HERO, HERO_PARTS, HERO_SLOTS, randomHero, type HeroParts } from '@heroes/shared';
import { prisma } from '../src/platform/db.js';
import { call, setupTeacher } from './helpers.js';

describe('тематические коллекции героя', () => {
  it('открыты всем по уровню: детали разных сезонов смешиваются, уровень проверяет сервер', async () => {
    const t = await setupTeacher(['Маша']);
    const cookie = await t.studentCookie(0);
    expect((await call('PUT', '/api/student/hero', { cookie, body: { name: '', parts: { ...DEFAULT_HERO, emblem: 'emblem.diamond' } } })).status).toBe(200);
    const parts: HeroParts = {
      ...DEFAULT_HERO, suit: 'suit.bloom', mask: 'mask.winterHat', cape: 'cape.sail', emblem: 'emblem.maple', aura: 'aura.snowfall', suitColor: 'color.ochre',
    };
    const save = () => call('PUT', '/api/student/hero', { cookie, body: { name: 'Времена года', parts } });
    expect((await save()).body.error).toMatch(/уровн/);
    await prisma.pointEvent.create({ data: { studentId: t.students[0].id, value: 70, reasonName: 'Тест уровня', emoji: '⭐' } });
    expect((await save()).status).toBe(200);
    expect((await call('GET', '/api/student/profile', { cookie })).body.hero).toMatchObject({ name: 'Времена года', parts });
  });

  it('случайный герой новичка не выдаёт детали коллекций', () => {
    const themed = HERO_PARTS.filter((p) => p.themed).map((p) => p.id);
    expect(themed.length).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < 200; i++) expect(Object.values(randomHero()).some((id) => themed.includes(id))).toBe(false);
    const fresh = randomHero(() => 0.99);
    for (const slot of Object.keys(HERO_SLOTS) as (keyof HeroParts)[]) expect(HERO_PARTS.find((p) => p.id === fresh[slot])?.themed).not.toBe(true);
  });
});
