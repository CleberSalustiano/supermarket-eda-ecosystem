import type { ProcessedEvent } from '#/domain/entities/processed-event.entity';

export interface ProcessedEventRepositoryPort {
  findByEventId(eventId: string): Promise<ProcessedEvent | null>;
  findByAggregateIdAndEventName(
    tenantId: string,
    aggregateId: string,
    eventName: string
  ): Promise<ProcessedEvent | null>;
  save(event: ProcessedEvent): Promise<void>;
}
