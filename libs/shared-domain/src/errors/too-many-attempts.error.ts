export class TooManyAttemptsError extends Error {
  readonly code = 'TOO_MANY_ATTEMPTS';

  constructor(message: string) {
    super(message);
    this.name = 'TooManyAttemptsError';
  }
}
