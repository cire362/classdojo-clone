import { describe, expect, it } from 'vitest';
import { generatePassword, hashPassword, loginBase, pickLogin, verifyPassword } from '../src/lib/credentials.js';

describe('логины и пароли', () => {
  it('транслитерация имени в логин', () => {
    expect(loginBase('Маша Иванова')).toBe('masha.i');
    expect(loginBase('  Щукин   Юрий ')).toBe('schukin.y');
    expect(loginBase('Артём')).toBe('artem');
    expect(loginBase('???')).toBe('hero');
  });

  it('подбор свободного логина', () => {
    expect(pickLogin('masha.i', new Set())).toBe('masha.i');
    expect(pickLogin('masha.i', new Set(['masha.i', 'masha.i2']))).toBe('masha.i3');
  });

  it('пароль читаемый и разный', () => {
    const a = generatePassword();
    expect(a).toMatch(/^[a-z]+\d{3}[a-z]+$/);
    const set = new Set(Array.from({ length: 50 }, generatePassword));
    expect(set.size).toBeGreaterThan(45);
  });

  it('пароль хранится как argon2-хеш', async () => {
    const h = await hashPassword('secret123');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(h, 'secret123')).toBe(true);
    expect(await verifyPassword(h, 'wrong')).toBe(false);
  });
});
