type Account = { name: string; login: string };

const AUTO_PASSWORD = 'От 3 символов: латинские буквы, цифры, точка или дефис. Пароль создадим автоматически.';

/** Имя и логин нового входа: пароль создаётся автоматически и показывается один раз */
export function AccountFields<T extends Account>({ idPrefix, nameLabel, value, onChange, loginHint = AUTO_PASSWORD }: {
  idPrefix: string;
  nameLabel: string;
  loginHint?: string;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <>
      <div>
        <label className="label" htmlFor={`${idPrefix}-name`}>{nameLabel}</label>
        <input
          id={`${idPrefix}-name`}
          className="input"
          autoComplete="off"
          maxLength={80}
          required
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}-login`}>Логин</label>
        <input
          id={`${idPrefix}-login`}
          className="input font-mono"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          minLength={3}
          maxLength={64}
          pattern="[a-zA-Z0-9._\-]{3,64}"
          required
          value={value.login}
          onChange={(e) => onChange({ ...value, login: e.target.value })}
          aria-describedby={`${idPrefix}-login-hint`}
        />
        <p id={`${idPrefix}-login-hint`} className="mt-2 text-sm text-ink-soft">
          {loginHint}
        </p>
      </div>
    </>
  );
}
