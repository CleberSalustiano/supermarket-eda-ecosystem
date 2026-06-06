import { randomBytes, scrypt as rawScrypt } from 'crypto';
import { promisify } from 'util';

import { Injectable } from '@nestjs/common';

import type { CredentialHasherPort } from '../../application/ports/credential-hasher.port';

const scrypt = promisify(rawScrypt);

@Injectable()
export class ScryptCredentialHasherService implements CredentialHasherPort {
  async hash(rawValue: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(rawValue, salt, 64)) as Buffer;

    return `${salt}:${derivedKey.toString('hex')}`;
  }
}
