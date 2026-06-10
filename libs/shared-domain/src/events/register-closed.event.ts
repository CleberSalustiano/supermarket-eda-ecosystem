import type { TenantScoped } from '../identifiers/tenant-scoped.interface';
import { createEventEnvelope, type EventEnvelope } from './event-envelope';
import { KafkaTopics } from './kafka-topics';

export const REGISTER_CLOSED_EVENT_NAME = 'RegisterClosed';

export interface RegisterClosedEventPayload extends TenantScoped {
  sessionId: string;
  registerId: string;
  operatorId: string;
  openingFloatAmount: number;
  declaredCashAmount: number;
  closedAt: string;
}

export function createRegisterClosedEvent(
  payload: RegisterClosedEventPayload
): EventEnvelope<RegisterClosedEventPayload> {
  return createEventEnvelope({
    eventName: REGISTER_CLOSED_EVENT_NAME,
    topic: KafkaTopics.checkout.registerClosed,
    aggregateId: payload.sessionId,
    payload
  });
}
