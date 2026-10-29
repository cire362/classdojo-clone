import { prisma } from '../db.js';
import { HttpError, notFound } from '../lib/errors.js';

/** Цвета команд — из палитры героев, чтобы команды отличались и в тёмной теме */
export const TEAM_COLORS = ['#e63946', '#2f6fde', '#2a9d55', '#f77f00', '#7b4fd6', '#14a3a3'] as const;
export const MAX_TEAMS = 6;

export function groupTeams(groupId: string) {
  return prisma.team.findMany({ where: { groupId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, name: true, color: true } });
}

export async function createTeam(groupId: string, name: string, color?: string) {
  const count = await prisma.team.count({ where: { groupId } });
  if (count >= MAX_TEAMS) throw new HttpError(400, `Команд может быть не больше ${MAX_TEAMS}`);
  return prisma.team.create({
    data: { groupId, name, color: color ?? TEAM_COLORS[count % TEAM_COLORS.length], sortOrder: count },
    select: { id: true, name: true, color: true },
  });
}

export async function updateTeam(groupId: string, teamId: string, data: { name?: string; color?: string }) {
  const { count } = await prisma.team.updateMany({ where: { id: teamId, groupId }, data });
  if (!count) throw notFound('Команда не найдена');
}

/** Удаление команды: её участники остаются без команды */
export async function deleteTeam(groupId: string, teamId: string) {
  const { count } = await prisma.team.deleteMany({ where: { id: teamId, groupId } });
  if (!count) throw notFound('Команда не найдена');
}

/** Состав команд: { ученик → команда или null }. Ученики и команды — только этой группы */
export async function assignTeams(groupId: string, assignments: Record<string, string | null>) {
  const [students, teams] = await Promise.all([
    prisma.student.findMany({ where: { groupId, id: { in: Object.keys(assignments) } }, select: { id: true } }),
    groupTeams(groupId),
  ]);
  if (students.length !== Object.keys(assignments).length) throw notFound('Ученик не найден');
  const teamIds = new Set(teams.map((t) => t.id));
  if (Object.values(assignments).some((t) => t !== null && !teamIds.has(t))) throw notFound('Команда не найдена');
  await prisma.$transaction(
    Object.entries(assignments).map(([studentId, teamId]) => prisma.student.update({ where: { id: studentId }, data: { teamId } })),
  );
}
