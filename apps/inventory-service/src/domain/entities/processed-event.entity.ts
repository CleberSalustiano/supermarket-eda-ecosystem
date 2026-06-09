import { DomainValidationError } from '@supermarket/shared-domain';

export interface ProcessedEventPrimitives {
  eventId: string;
  eventName: string;
  aggregateId: string;
  tenantId: string;
  processedAt: string;
  createdAt: string;
}

interface RecordProcessedEventInput {
  eventId: string;
  eventName: string;
  aggregateId: string;
  tenantId: string;
  processedAt?: Date;
  createdAt?: Date;
}

interface RehydrateProcessedEventInput {
  eventId: string;
  eventName: string;
  aggregateId: string;
  tenantId: string;
  processedAt: Date;
  createdAt: Date;
}

export class ProcessedEvent {
  private constructor(
    private readonly eventId: string,
    private readonly eventName: string,
    private readonly aggregateId: string,
    private readonly tenantId: string,
    private readonly processedAt: Date,
    private readonly createdAt: Date
  ) {}

  static record(input: RecordProcessedEventInput): ProcessedEvent {
    const now = input.processedAt ?? new Date();

    return new ProcessedEvent(
      normalizeIdentifier(input.eventId, 'Event id'),
      normalizeRequiredString(input.eventName, 'Event name'),
      normalizeIdentifier(input.aggregateId, 'Aggregate id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      ensureDate(input.processedAt ?? now, 'Processed at'),
      ensureDate(input.createdAt ?? now, 'Created at')
    );
  }

  static rehydrate(input: RehydrateProcessedEventInput): ProcessedEvent {
    return new ProcessedEvent(
      normalizeIdentifier(input.eventId, 'Event id'),
      normalizeRequiredString(input.eventName, 'Event name'),
      normalizeIdentifier(input.aggregateId, 'Aggregate id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      ensureDate(input.processedAt, 'Processed at'),
      ensureDate(input.createdAt, 'Created at')
    );
  }

  toPrimitives(): ProcessedEventPrimitives {
    return {
      eventId: this.eventId,
      eventName: this.eventName,
      aggregateId: this.aggregateId,
      tenantId: this.tenantId,
      processedAt: this.processedAt.toISOString(),
      createdAt: this.createdAt.toISOString()
    };
  }
}

function normalizeIdentifier(value: string, label: string): string {
  return normalizeRequiredString(value, label);
}

function normalizeRequiredString(value: string, label: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new DomainValidationError(`${label} cannot be empty`);
  }

  return normalizedValue;
}

function ensureDate(value: Date, label: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${label} is invalid`);
  }

  return value;
}
