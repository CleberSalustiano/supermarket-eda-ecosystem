import type { TenantScoped } from '../identifiers/tenant-scoped.interface';
import { SalePaymentMethod } from '../enums/sale-payment-method.enum';
import { createEventEnvelope, type EventEnvelope } from './event-envelope';
import { KafkaTopics } from './kafka-topics';

export const SALE_COMPLETED_EVENT_NAME = 'SaleCompleted';

export interface SaleCompletedEventItemPayload {
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface SaleCompletedEventPayload extends TenantScoped {
  saleId: string;
  sessionId: string;
  registerId: string;
  operatorId: string;
  paymentMethod: SalePaymentMethod;
  paidAmount: number;
  changeAmount: number;
  totalItemsQuantity: number;
  subtotal: number;
  total: number;
  completedAt: string;
  items: SaleCompletedEventItemPayload[];
}

export function createSaleCompletedEvent(
  payload: SaleCompletedEventPayload
): EventEnvelope<SaleCompletedEventPayload> {
  return createEventEnvelope({
    eventName: SALE_COMPLETED_EVENT_NAME,
    topic: KafkaTopics.checkout.saleCompleted,
    aggregateId: payload.saleId,
    payload
  });
}
