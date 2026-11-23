export class DependencyUnavailableError extends Error {
  readonly code = 'DEPENDENCY_UNAVAILABLE';

  constructor(message: string) {
    super(message);
    this.name = 'DependencyUnavailableError';
  }
}
