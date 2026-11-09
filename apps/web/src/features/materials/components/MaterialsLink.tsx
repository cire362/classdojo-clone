import { Link } from 'react-router-dom';

/** Вход в методички с главной преподавателя: такой же раздел, как потоки */
export function MaterialsLink() {
  return (
    <section className="space-y-3" aria-labelledby="materials-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="materials-title" className="text-lg">Методички</h2>
        <Link to="/materials" className="btn btn-secondary">Открыть методички</Link>
      </div>
      <p className="text-sm text-ink-soft">
        Свои материалы к урокам и материалы коллег: Word, PDF, презентации. Открываются без скачивания.
      </p>
    </section>
  );
}
