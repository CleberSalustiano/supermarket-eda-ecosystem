export const CREDENTIAL_HASHER = Symbol('CREDENTIAL_HASHER');

export interface CredentialHasherPort {
  hash(rawValue: string): Promise<string>;
}
