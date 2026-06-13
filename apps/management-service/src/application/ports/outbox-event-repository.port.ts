import type { EventEnvelope, EventPayload } from '@supermarket/shared-domain';

export const OUTBOX_EVENT_REPOSITORY = Symbol('OUTBOX_EVENT_REPOSITORY');

export interface StoredOutboxEvent<TPayload extends EventPayload = EventPayload>
  extends EventEnvelope<TPayload> {
  attempts: number;
  failureReason: string | null;
  publishedAt: string | null;
}

export interface OutboxEventRepositoryPort {
  save<TPayload extends EventPayload>(event: EventEnvelope<TPayload>): Promise<void>;
  findById(eventId: string): Promise<StoredOutboxEvent | null>;
  findPendingBatch(limit: number): Promise<StoredOutboxEvent[]>;
  markPublished(eventId: string, publishedAt: Date): Promise<void>;
  registerFailure(eventId: string, failureReason: string): Promise<void>;
}
