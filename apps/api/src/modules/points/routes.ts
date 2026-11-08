import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { teacherGroup } from '../access/index.js';
import { classGoal } from '../goals/index.js';
import { checkGroupSubject } from '../subjects/index.js';
import { awardPoints, cardSummaries, deletePointEvents } from './service.js';

const id = z.string().min(1).max(64);
const AwardBody = z.object({ studentIds: z.array(id).min(1).max(200), reasonId: id, subjectId: id.nullable().optional() });
const UndoBody = z.object({ eventIds: z.array(id).min(1).max(200) });

/** Начисление и отмена баллов. Роль проверяет сборка routes/teacher.ts */
export const pointRoutes = new Hono<AppEnv>()
  .post('/groups/:id/points', async (c) => {
    const group = await teacherGroup(c.get('user'), c.req.param('id'), { writable: true });
    const body = parse(AwardBody, await c.req.json().catch(() => null));
    const { reason, events } = await awardPoints({
      groupId: group.id,
      studentIds: body.studentIds,
      reasonId: body.reasonId,
      subjectId: await checkGroupSubject(group.id, body.subjectId),
      awardedById: c.get('user').accountId,
    });
    const summaries = await cardSummaries(body.studentIds);
    return c.json(
      {
        value: reason.value,
        classGoal: await classGoal(group.id),
        eventIds: events.map((e) => e.id),
        summaries: Object.fromEntries(summaries),
      },
      201,
    );
  })
  .post('/points/undo', async (c) => {
    const { eventIds } = parse(UndoBody, await c.req.json().catch(() => null));
    const summaries = await deletePointEvents(c.get('user').teacherId!, eventIds);
    return c.json({ summaries: Object.fromEntries(summaries) });
  })
  // Удаление ошибочной записи из истории ученика
  .delete('/points/:id', async (c) => {
    const summaries = await deletePointEvents(c.get('user').teacherId!, [c.req.param('id')]);
    return c.json({ summaries: Object.fromEntries(summaries) });
  });
