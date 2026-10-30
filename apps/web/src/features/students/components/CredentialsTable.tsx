import type { Credentials } from '../../../api';

/** Логины и пароли, выданные только что: показываются один раз */
export function CredentialsTable({ rows }: { rows: Credentials[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-2 text-ink-soft">
          <tr>
            <th className="px-3 py-2 font-semibold">Имя</th>
            <th className="px-3 py-2 font-semibold">Логин</th>
            <th className="px-3 py-2 font-semibold">Пароль</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2 font-mono">{r.login}</td>
              <td className="px-3 py-2 font-mono">{r.password}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
