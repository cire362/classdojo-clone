import { expect, it } from 'vitest';
import { DEFAULT_HERO } from '@heroes/shared';
import { prisma } from '../src/platform/db.js';
import { call, setupTeacher } from './helpers.js';

it('Искатели сочетаются с прежними вещами, сохраняются без сброса и проверяют уровень на сервере', async () => {
  const t = await setupTeacher(['Мира']);
  const cookie = await t.studentCookie(0);
  const original = { ...DEFAULT_HERO, skin: 'skin.5', hair: 'hair.curly', cape: 'cape.classic', pet: 'pet.fox' };
  await prisma.hero.update({ where: { studentId: t.students[0].id }, data: { parts: original } });
  const parts = { ...original, suit: 'suit.ranger', cape: 'cape.satchel' };
  const saved = await call('PUT', '/api/student/hero', { cookie, body: { name: 'Искатель', parts } });
  expect(saved).toMatchObject({ status: 200, body: { parts } });
  const wings = { ...parts, cape: 'cape.glider' };
  expect((await call('PUT', '/api/student/hero', { cookie, body: { name: 'Искатель', parts: wings } })).status).toBe(422);
  expect((await prisma.hero.findUniqueOrThrow({ where: { studentId: t.students[0].id } })).parts).toEqual(parts);
  await prisma.pointEvent.create({ data: { studentId: t.students[0].id, value: 190, reasonName: 'Уровень для теста', emoji: 'star' } });
  expect((await call('PUT', '/api/student/hero', { cookie, body: { name: 'Искатель', parts: wings } })).status).toBe(200);
});

it('ученик первого уровня может заменить заданную учителем причёску без изменения одежды и питомца', async () => {
  const t = await setupTeacher(['Миша']);
  const parts = { ...DEFAULT_HERO, hair: 'hair.long', pet: 'pet.fox' };
  expect((await call('PUT', `/api/teacher/students/${t.students[0].id}/hero`, {
    cookie: t.cookie, body: { name: 'Искатель', parts },
  })).status).toBe(200);
  const cookie = await t.studentCookie(0);
  const next = { ...parts, hair: 'hair.short', skin: 'skin.4', hairColor: 'hairColor.black' };
  expect(await call('PUT', '/api/student/hero', { cookie, body: { name: 'Искатель', parts: next } }))
    .toMatchObject({ status: 200, body: { name: 'Искатель', parts: next } });
  const profile = await call('GET', '/api/student/profile', { cookie });
  expect(profile.body.hero).toEqual({ name: 'Искатель', parts: next });
});

it('старая вкладка сохраняет выбранный пол героя, неизвестное значение отклоняется', async () => {
  const t = await setupTeacher(['Женя']);
  const cookie = await t.studentCookie(0);
  const parts = { ...DEFAULT_HERO, gender: 'gender.girl' };
  const save = (value: Record<string, string>) => call('PUT', '/api/student/hero', { cookie, body: { name: '', parts: value } });
  expect((await save(parts)).status).toBe(200);
  const legacy: Record<string, string> = { ...parts, hair: 'hair.long' };
  delete legacy.gender;
  expect((await save(legacy)).body.parts).toEqual({ ...legacy, gender: 'gender.girl' });
  expect((await save({ ...parts, gender: 'skin.1' })).status).toBe(422);
});
