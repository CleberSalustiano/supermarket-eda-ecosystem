export const CREDENTIAL_HASHER = Symbol('CREDENTIAL_HASHER');

export interface CredentialHasherPort {
  hash(rawValue: string): Promise<string>;
  /**
   * Verifies a raw value against a stored hash in constant time.
   * A `null` hash (unknown subject) still performs the full key derivation, so timing does not
   * reveal whether the subject exists.
   */
  verify(rawValue: string, storedHash: string | null): Promise<boolean>;
}
