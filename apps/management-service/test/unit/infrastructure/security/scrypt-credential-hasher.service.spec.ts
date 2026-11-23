import * as crypto from 'crypto';

import { ScryptCredentialHasherService } from '#/infrastructure/security/scrypt-credential-hasher.service';

jest.mock('crypto', () => {
  const actual = jest.requireActual<typeof import('crypto')>('crypto');

  return {
    ...actual,
    scrypt: jest.fn(actual.scrypt),
    timingSafeEqual: jest.fn(actual.timingSafeEqual)
  };
});

describe('ScryptCredentialHasherService', () => {
  const hasher = new ScryptCredentialHasherService();

  beforeEach(() => {
    jest.mocked(crypto.scrypt).mockClear();
    jest.mocked(crypto.timingSafeEqual).mockClear();
  });

  it('stores <salt>:<hash> and verifies the same value', async () => {
    const hash = await hasher.hash('123456');

    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    await expect(hasher.verify('123456', hash)).resolves.toBe(true);
  });

  it('produces a different salt for every hash', async () => {
    expect(await hasher.hash('123456')).not.toBe(await hasher.hash('123456'));
  });

  it('verifies a hash produced with the Node scrypt defaults', async () => {
    const salt = 'a'.repeat(32);
    const key = crypto.scryptSync('4321', salt, 64);

    await expect(hasher.verify('4321', `${salt}:${key.toString('hex')}`)).resolves.toBe(true);
  });

  it('rejects a wrong value', async () => {
    const hash = await hasher.hash('123456');

    await expect(hasher.verify('123457', hash)).resolves.toBe(false);
  });

  it.each(['', 'nocolon', 'salt:', ':hash', 'salt:zz', 'salt:abcd', 'a:b:c'])(
    'returns false for the malformed hash %p',
    async (storedHash) => {
      await expect(hasher.verify('123456', storedHash)).resolves.toBe(false);
    }
  );

  it('still derives a key when the hash is null, and returns false', async () => {
    await expect(hasher.verify('123456', null)).resolves.toBe(false);
    expect(crypto.scrypt).toHaveBeenCalledTimes(1);
  });

  it('compares with timingSafeEqual', async () => {
    const hash = await hasher.hash('123456');
    await hasher.verify('123456', hash);

    expect(crypto.timingSafeEqual).toHaveBeenCalledTimes(1);
  });
});
