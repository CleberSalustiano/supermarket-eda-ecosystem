import { randomUUID } from 'crypto';

import type { TenantScoped } from '../identifiers/tenant-scoped.interface';

export type EventPayload = TenantScoped;

export interface EventEnvelope<TPayload extends EventPayload = EventPayload> {
  eventId: string;
  eventName: string;
  topic: string;
  aggregateId: string;
  tenantId: string;
  occurredAt: string;
  payload: TPayload;
}

export interface CreateEventEnvelopeInput<
  TPayload extends EventPayload = EventPayload
> {
  eventId?: string;
  occurredAt?: string;
  eventName: string;
  topic: string;
  aggregateId: string;
  payload: TPayload;
}

export function createEventEnvelope<TPayload extends EventPayload>(
  input: CreateEventEnvelopeInput<TPayload>
): EventEnvelope<TPayload> {
  return {
    eventId: input.eventId ?? randomUUID(),
    eventName: input.eventName,
    topic: input.topic,
    aggregateId: input.aggregateId,
    tenantId: input.payload.tenantId,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    payload: input.payload
  };
}
