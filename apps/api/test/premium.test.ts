import { describe, expect, it } from 'vitest';
import { DEFAULT_HERO, HERO_PARTS, randomHero } from '@heroes/shared';
import { prisma } from '../src/db.js';
import { call, setupTeacher } from './helpers.js';

const premiumHero = { ...DEFAULT_HERO, emblem: 'emblem.diamond', suitColor: 'color.cosmic' };

describe('премиум', () => {
  it('без премиума детали коллекции недоступны, с премиумом создателя группы — доступны', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const cookie = await t.studentCookie(0);

    expect((await call('GET', '/api/student/profile', { cookie })).body.premium).toBe(false);
    const denied = await call('PUT', '/api/student/hero', { cookie, body: { name: '', parts: premiumHero } });
    expect(denied.status).toBe(422);
    expect(denied.body.error).toMatch(/премиум-коллекции/);
    expect((await call('GET', '/api/teacher/plan', { cookie: t.cookie })).body).toEqual({ active: false, until: null, freeForAll: false });

    await prisma.teacher.update({ where: { id: t.teacher.id }, data: { premiumUntil: new Date(Date.now() + 86_400_000) } });
    expect((await call('GET', '/api/student/profile', { cookie })).body.premium).toBe(true);
    expect((await call('PUT', '/api/student/hero', { cookie, body: { name: '', parts: premiumHero } })).status).toBe(200);
    expect((await call('GET', '/api/teacher/plan', { cookie: t.cookie })).body.active).toBe(true);
    // Уровень по-прежнему нужен: галактика открывается с 4-го
    const tooEarly = await call('PUT', '/api/student/hero', { cookie, body: { name: '', parts: { ...DEFAULT_HERO, aura: 'aura.galaxy' } } });
    expect(tooEarly.status).toBe(422);
    expect(tooEarly.body.error).toMatch(/4 уровне/);
  });

  it('истёкший премиум и премиум соавтора коллекцию не открывают', async () => {
    const t = await setupTeacher(['Маша Иванова']);
    const colleague = await setupTeacher(['Другой Ученик']);
    await prisma.groupTeacher.create({ data: { groupId: t.group.id, teacherId: colleague.teacher.id } });
    await prisma.teacher.update({ where: { id: colleague.teacher.id }, data: { premiumUntil: new Date(Date.now() + 86_400_000) } });
    await prisma.teacher.update({ where: { id: t.teacher.id }, data: { premiumUntil: new Date(Date.now() - 1000) } });
    const cookie = await t.studentCookie(0);
    expect((await call('PUT', '/api/student/hero', { cookie, body: { name: '', parts: premiumHero } })).status).toBe(422);
  });

  it('каталог: премиум-детали помечены в БД, случайный герой их не выдаёт', async () => {
    await setupTeacher(['Кто-то']);
    const premiumIds = HERO_PARTS.filter((p) => p.premium).map((p) => p.id);
    expect(premiumIds.length).toBeGreaterThanOrEqual(5);
    const rows = await prisma.heroPart.findMany({ where: { id: { in: premiumIds } } });
    expect(rows.every((r) => r.isPremium)).toBe(true);
    for (let i = 0; i < 200; i++) {
      const hero = randomHero();
      expect(Object.values(hero).some((id) => premiumIds.includes(id))).toBe(false);
    }
  });
});
