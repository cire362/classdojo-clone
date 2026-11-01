/** Код на листе с разделителем читается и диктуется легче; сервер принимает его и так, и так */
export const formatInviteCode = (code: string) => `${code.slice(0, 5)}-${code.slice(5)}`;

export const inviteLink = (code: string) => `${window.location.origin}/invite#${code}`;
