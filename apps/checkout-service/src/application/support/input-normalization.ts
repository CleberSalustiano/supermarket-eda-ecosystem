import { DomainValidationError } from '@supermarket/shared-domain';

export function normalizeRequiredValue(value: string, label: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new DomainValidationError(`${label} cannot be empty`);
  }

  return normalizedValue;
}

export function normalizePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainValidationError(`${label} must be a positive integer`);
  }

  return value;
}
