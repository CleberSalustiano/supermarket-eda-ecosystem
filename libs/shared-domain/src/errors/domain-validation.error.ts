export class DomainValidationError extends Error {
  readonly code = 'DOMAIN_VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'DomainValidationError';
  }
}
