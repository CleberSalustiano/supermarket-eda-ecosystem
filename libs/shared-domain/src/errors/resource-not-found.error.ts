export class ResourceNotFoundError extends Error {
  readonly code = 'RESOURCE_NOT_FOUND';

  constructor(message: string) {
    super(message);
    this.name = 'ResourceNotFoundError';
  }
}
