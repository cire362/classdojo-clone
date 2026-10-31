import { api, type Team } from '../../lib/api';

const teamsPath = (groupId: string) => `/teacher/groups/${groupId}/teams`;

export const createTeam = (groupId: string, name: string) => api<Team[]>('POST', teamsPath(groupId), { name });

export const renameTeam = (groupId: string, teamId: string, name: string) =>
  api<Team[]>('PATCH', `${teamsPath(groupId)}/${teamId}`, { name });

export const deleteTeam = (groupId: string, teamId: string) => api<Team[]>('DELETE', `${teamsPath(groupId)}/${teamId}`);

export const assignTeams = (groupId: string, assignments: unknown) => api('PUT', `${teamsPath(groupId)}/assign`, { assignments });
