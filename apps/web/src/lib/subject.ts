/**
 * Текущая дисциплина урока у группы: запоминается в браузере преподавателя, баллы и отметка урока уходят с ней.
 * Значение проверяется по списку дисциплин группы: удалённая дисциплина просто перестаёт выбираться
 */
const key = (groupId: string) => `heroes:subject:${groupId}`;

export function currentSubject(groupId: string, allowed: { subject: { id: string } }[]): string | null {
  try {
    const id = localStorage.getItem(key(groupId));
    return id && allowed.some((s) => s.subject.id === id) ? id : null;
  } catch {
    return null;
  }
}

export function rememberSubject(groupId: string, subjectId: string | null) {
  try {
    if (subjectId) localStorage.setItem(key(groupId), subjectId);
    else localStorage.removeItem(key(groupId));
  } catch {
    /* без хранилища выбор живёт до перезагрузки */
  }
}
