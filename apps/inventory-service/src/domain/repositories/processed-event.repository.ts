import type { ProcessedEvent } from '../entities/processed-event.entity';

export const PROCESSED_EVENT_REPOSITORY = Symbol('PROCESSED_EVENT_REPOSITORY');

export interface ProcessedEventRepositoryPort {
  findByEventId(eventId: string): Promise<ProcessedEvent | null>;
  findByAggregateIdAndEventName(
    tenantId: string,
    aggregateId: string,
    eventName: string
  ): Promise<ProcessedEvent | null>;
  save(event: ProcessedEvent): Promise<void>;
}
