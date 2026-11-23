import { randomBytes, scrypt as rawScrypt, timingSafeEqual } from 'crypto';
import type { ScryptOptions } from 'crypto';
import { promisify } from 'util';

import { Injectable } from '@nestjs/common';

import type { CredentialHasherPort } from '#/application/ports/credential-hasher.port';

const scrypt = promisify(rawScrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

const KEY_LENGTH = 64;
// Node's defaults, spelled out so stored hashes stay valid if the defaults ever change.
const SCRYPT_OPTIONS: ScryptOptions = { N: 16384, r: 8, p: 1 };

@Injectable()
export class ScryptCredentialHasherService implements CredentialHasherPort {
  private readonly decoySalt = randomBytes(16).toString('hex');
  private readonly decoyKey = randomBytes(KEY_LENGTH);

  async hash(rawValue: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = await scrypt(rawValue, salt, KEY_LENGTH, SCRYPT_OPTIONS);

    return `${salt}:${derivedKey.toString('hex')}`;
  }

  async verify(rawValue: string, storedHash: string | null): Promise<boolean> {
    if (storedHash === null) {
      const derivedKey = await scrypt(rawValue, this.decoySalt, KEY_LENGTH, SCRYPT_OPTIONS);

      timingSafeEqual(derivedKey, this.decoyKey);

      return false;
    }

    const [salt, expectedHex, ...rest] = storedHash.split(':');

    if (!salt || !expectedHex || rest.length > 0 || !/^[0-9a-f]+$/i.test(expectedHex)) {
      return false;
    }

    const expectedKey = Buffer.from(expectedHex, 'hex');

    if (expectedKey.length !== KEY_LENGTH) {
      return false;
    }

    const derivedKey = await scrypt(rawValue, salt, KEY_LENGTH, SCRYPT_OPTIONS);

    return timingSafeEqual(derivedKey, expectedKey);
  }
}
