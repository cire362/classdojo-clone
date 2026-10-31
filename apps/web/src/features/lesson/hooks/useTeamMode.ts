import { useState } from 'react';

const TEAM_MODE_KEY = 'heroes:teams:';

function storedTeamMode(groupId: string): boolean {
  try {
    return localStorage.getItem(TEAM_MODE_KEY + groupId) === '1';
  } catch {
    return false;
  }
}

function rememberTeamMode(groupId: string, on: boolean) {
  try {
    if (on) localStorage.setItem(TEAM_MODE_KEY + groupId, '1');
    else localStorage.removeItem(TEAM_MODE_KEY + groupId);
  } catch {
    // без запоминания
  }
}

/** Командный режим урока запоминается для группы */
export function useTeamMode(groupId: string): [boolean, (on: boolean) => void] {
  const [teamMode, setTeamMode] = useState(() => storedTeamMode(groupId));
  return [
    teamMode,
    (on) => {
      setTeamMode(on);
      rememberTeamMode(groupId, on);
    },
  ];
}
