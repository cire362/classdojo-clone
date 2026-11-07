import { Hono } from 'hono';
import { requireRole, requireSchoolRole, type AppEnv } from '../../platform/auth.js';
import { parse } from '../../platform/errors.js';
import { ReasonBody } from './routes.js';
import { addSchoolReason, archiveSchoolReason, schoolReasons, updateSchoolReason } from './school.service.js';

const SchoolReasonBody = ReasonBody.omit({ countsForHelpBadge: true });
const MANAGERS = requireSchoolRole('DIRECTOR', 'DEPUTY');

/** Общие причины школы: видит вся администрация, меняют директор и завуч */
export const adminReasonRoutes = new Hono<AppEnv>()
  .use(requireRole('ADMIN'))
  .get('/school-reasons', async (c) => c.json(await schoolReasons(c.get('user').schoolId!)))
  .post('/school-reasons', MANAGERS, async (c) => {
    const body = parse(SchoolReasonBody, await c.req.json().catch(() => null));
    return c.json(await addSchoolReason(c.get('user').schoolId!, body), 201);
  })
  .patch('/school-reasons/:id', MANAGERS, async (c) => {
    const body = parse(SchoolReasonBody, await c.req.json().catch(() => null));
    return c.json(await updateSchoolReason(c.get('user').schoolId!, c.req.param('id'), body));
  })
  .delete('/school-reasons/:id', MANAGERS, async (c) => c.json(await archiveSchoolReason(c.get('user').schoolId!, c.req.param('id'))));
