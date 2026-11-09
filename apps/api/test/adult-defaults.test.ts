import { expect, it } from 'vitest';
import { prisma } from '../src/platform/db.js';
import { call, setupTeacher } from './helpers.js';

const newGroup = async (cookie: string) =>
  (await call('POST', '/api/teacher/groups', { cookie, body: { name: 'Новая' } })).body.id as string;

it('новая группа колледжа получает причины и награду для студентов, школьная — школьные', async () => {
  const college = await prisma.school.create({ data: { name: 'Колледж', kind: 'COLLEGE' } });
  const lecturer = await setupTeacher([], college.id);
  const groupId = await newGroup(lecturer.cookie);
  const reasons = (await call('GET', `/api/teacher/groups/${groupId}/reasons`, { cookie: lecturer.cookie })).body;
  const names = reasons.map((r: { name: string }) => r.name);
  expect(names).toEqual(expect.arrayContaining(['Активная работа на занятии', 'Помощь одногруппнику', 'Опоздание', 'Задание не сдано']));
  expect(names).not.toContain('Помог другу');
  expect(reasons.find((r: { name: string }) => r.name === 'Помощь одногруппнику').countsForHelpBadge).toBe(true);
  const rewards = await prisma.reward.findMany({ where: { groupId }, select: { title: true } });
  expect(rewards.map((r) => r.title)).toEqual(['Сдать задание на день позже']);

  const school = await setupTeacher([]);
  const schoolGroup = await newGroup(school.cookie);
  const schoolReasons = (await call('GET', `/api/teacher/groups/${schoolGroup}/reasons`, { cookie: school.cookie })).body;
  expect(schoolReasons.map((r: { name: string }) => r.name)).toContain('Помог другу');
  expect(await prisma.reward.count({ where: { groupId: schoolGroup } })).toBe(4);
});

it('значки студента колледжа — словами для взрослых', async () => {
  const college = await prisma.school.create({ data: { name: 'Колледж', kind: 'COLLEGE' } });
  const t = await setupTeacher(['Анна Белова'], college.id);
  const profile = (await call('GET', '/api/student/profile', { cookie: await t.studentCookie(0) })).body;
  const titles = profile.badges.map((b: { title: string }) => b.title);
  expect(titles).toEqual(['Всегда на месте', 'Надёжный одногруппник', 'Первый герой группы']);
  expect(profile.badges[0].description).toBe('Посетить 10 отмеченных занятий подряд без пропусков.');
  expect(profile.badges[0]).not.toHaveProperty('adult');
});
