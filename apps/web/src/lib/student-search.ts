/** Поиск по имени и логину: регистр, ё/е и лишние пробелы не мешают; порядок слов любой. */
export function matchesStudent(student: { name: string; login: string }, query: string): boolean {
  const normalize = (s: string) => s.normalize('NFC').toLocaleLowerCase('ru').replace(/ё/g, 'е');
  const haystack = normalize(`${student.name} ${student.login}`);
  return normalize(query).trim().split(/\s+/).every((word) => haystack.includes(word));
}
