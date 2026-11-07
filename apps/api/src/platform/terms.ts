import { AsyncLocalStorage } from 'node:async_hooks';
import { termsFor, type Terms } from '@heroes/shared/terms';

/**
 * Слова учреждения текущего запроса: сообщения об ошибках, PDF, Excel и архивы говорят «студент» в вузе
 * и «ученик» в школе без передачи типа через каждую функцию. Значение кладёт requireAuth.
 */
const store = new AsyncLocalStorage<Terms>();

export const withTerms = <T>(terms: Terms, run: () => T): T => store.run(terms, run);

/** Вне запроса (команды, фоновые задачи, тесты сервисов) и без входа — школьные слова */
export const terms = (): Terms => store.getStore() ?? termsFor('SCHOOL');
