import { useState } from 'react';
import { useToast } from '../../../ui/Toast';

/** Запрос с защитой от двойного нажатия: ошибка показывается всплывающим сообщением */
export function useSave(onDone: () => unknown) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run(request: () => Promise<unknown>) {
    setBusy(true);
    try {
      await request();
      await onDone();
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}
