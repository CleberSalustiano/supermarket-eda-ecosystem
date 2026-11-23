export class AuthorizationDeniedError extends Error {
  readonly code = 'AUTHORIZATION_DENIED';

  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationDeniedError';
  }
}
