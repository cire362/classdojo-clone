import { expect, it } from 'vitest';
import { DEFAULT_HERO, PET_COMPANIONS, normalizeHero, petStageForLevel, randomHero, renderHeroSvg, renderPetSvg, validateHeroSelection } from '@heroes/shared';
import { prisma } from '../src/platform/db.js';
import { call, login, setupTeacher } from './helpers.js';

it('у компаньонов три стадии роста на границах уровней 1, 4 и 7; неверный уровень безопасен', () => {
  expect([1, 3, 4, 6, 7, 10].map((level) => petStageForLevel(level).stage)).toEqual([1, 1, 2, 2, 3, 3]);
  expect(petStageForLevel(1)).toMatchObject({ title: 'Малыш', nextLevel: 4 });
  expect(petStageForLevel(4)).toMatchObject({ title: 'Напарник', nextLevel: 7 });
  expect(petStageForLevel(10)).toMatchObject({ title: 'Хранитель', nextLevel: null });
  expect(petStageForLevel(NaN).stage).toBe(1);
  expect(petStageForLevel(-1).stage).toBe(1);
});

it('каждый питомец меняет рисунок при росте; выбор героя остаётся прежним, в SVG нет чужой разметки', () => {
  for (const pet of PET_COMPANIONS) {
    const parts = { ...DEFAULT_HERO, pet: pet.id };
    const stages = [1, 4, 7].map((level) => renderHeroSvg(parts, { level }));
    expect(new Set(stages).size).toBe(3);
    expect(stages.every((svg) => svg.includes(`data-pet="${pet.id}"`))).toBe(true);
    for (const svg of stages) expect(svg).not.toMatch(/\{\w+\}|undefined|NaN/);
    expect(parts.pet).toBe(pet.id);
  }
  expect(renderPetSvg('pet.unknown')).not.toContain('data-pet');
  expect(renderPetSvg('"><script>alert(1)</script>')).not.toContain('<script>');
  expect(renderHeroSvg(DEFAULT_HERO, { level: 10 })).not.toContain('data-pet');
  expect(normalizeHero({ ...DEFAULT_HERO, pet: 'mask.domino' }).pet).toBe('pet.none');
  expect(validateHeroSelection({ ...DEFAULT_HERO, pet: 'pet.unknown' }, 1).ok).toBe(false);
  expect(randomHero().pet).toBe('pet.none');
});

it('питомец сохраняется учеником без премиума; преподаватель и родитель видят тот же выбор и уровень', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const cookie = await t.studentCookie(0);
  const saved = await call('PUT', '/api/student/hero', { cookie, body: { name: 'Капитан', parts: { ...DEFAULT_HERO, pet: 'pet.fox' }, level: 10 } });
  expect(saved.status).toBe(200);
  expect(saved.body.parts.pet).toBe('pet.fox');
  const profile = (await call('GET', '/api/student/profile', { cookie })).body;
  expect(profile.level.level).toBe(1); // уровень из запроса не принимается
  const teacher = (await call('GET', `/api/teacher/students/${t.students[0].id}/profile`, { cookie: t.cookie })).body;
  const parent = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  const parentProfile = (await call('GET', `/api/parent/children/${t.students[0].id}/profile`, { cookie: await login(parent.login, parent.password) })).body;
  expect(teacher.hero).toEqual(profile.hero);
  expect(parentProfile.hero).toEqual(profile.hero);
});

it('рост зависит от положительных баллов, списание не уменьшает питомца; исправление ошибочных баллов учитывается', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const cookie = await t.studentCookie(0);
  await call('PUT', '/api/student/hero', { cookie, body: { name: '', parts: { ...DEFAULT_HERO, pet: 'pet.sprout' } } });
  const level4 = await prisma.pointEvent.create({ data: { studentId: t.students[0].id, reasonName: 'Проект', emoji: '⭐', value: 45 } });
  const stage = async () => {
    const p = (await call('GET', '/api/student/profile', { cookie })).body;
    return petStageForLevel(p.level.level).stage;
  };
  expect(await stage()).toBe(2);
  await call('POST', `/api/teacher/groups/${t.group.id}/points`, { cookie: t.cookie, body: { reasonId: t.minusReason.id, studentIds: [t.students[0].id] } });
  expect(await stage()).toBe(2);
  const level7 = await prisma.pointEvent.create({ data: { studentId: t.students[0].id, reasonName: 'Проект', emoji: '⭐', value: 95 } });
  expect(await stage()).toBe(3);
  await call('DELETE', `/api/teacher/points/${level7.id}`, { cookie: t.cookie });
  expect(await stage()).toBe(2);
  await call('DELETE', `/api/teacher/points/${level4.id}`, { cookie: t.cookie });
  expect(await stage()).toBe(1);
  expect((await prisma.hero.findUniqueOrThrow({ where: { studentId: t.students[0].id } })).parts).toMatchObject({ pet: 'pet.sprout' });
});

it('старые данные получают пустой слот; старая вкладка без слота не стирает уже выбранного питомца', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const cookie = await t.studentCookie(0);
  const { pet: _, ...old } = DEFAULT_HERO;
  await prisma.hero.update({ where: { studentId: t.students[0].id }, data: { parts: old } });
  expect((await call('GET', '/api/student/profile', { cookie })).body.hero.parts.pet).toBe('pet.none');
  expect((await call('PUT', '/api/student/hero', { cookie, body: { name: 'Старый герой', parts: old } })).status).toBe(200);
  await call('PUT', '/api/student/hero', { cookie, body: { name: '', parts: { ...DEFAULT_HERO, pet: 'pet.owl' } } });
  const savedOld = await call('PUT', '/api/student/hero', { cookie, body: { name: 'Новое имя', parts: old } });
  expect(savedOld.body.parts.pet).toBe('pet.owl');
});

it('чужие ученики и родители не могут менять питомца; подмена слота и произвольная стадия отклоняются', async () => {
  const t = await setupTeacher(['Маша Иванова']);
  const other = await setupTeacher(['Чужой Ученик']);
  const cookie = await t.studentCookie(0);
  const path = `/api/teacher/students/${t.students[0].id}/hero`;
  const body = { name: '', parts: { ...DEFAULT_HERO, pet: 'pet.fox' } };
  expect((await call('PUT', path, { cookie: other.cookie, body })).status).toBe(404);
  expect((await call('PUT', path, { cookie, body })).status).toBe(403);
  const parent = (await call('POST', `/api/teacher/students/${t.students[0].id}/parents`, { cookie: t.cookie })).body;
  expect((await call('PUT', '/api/student/hero', { cookie: await login(parent.login, parent.password), body })).status).toBe(403);
  for (const parts of [{ ...body.parts, pet: 'pet.fox.adult' }, { ...body.parts, pet: 'mask.domino' }, { ...body.parts, petStage: '3' }]) {
    expect((await call('PUT', '/api/student/hero', { cookie, body: { name: '', parts } })).status).toBe(422);
  }
  expect((await call('PUT', path, { cookie: t.cookie, body })).status).toBe(200);
});
