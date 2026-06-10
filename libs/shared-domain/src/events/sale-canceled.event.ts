import type { TenantScoped } from '../identifiers/tenant-scoped.interface';
import type { SalePaymentMethod } from '../enums/sale-payment-method.enum';
import { createEventEnvelope, type EventEnvelope } from './event-envelope';
import { KafkaTopics } from './kafka-topics';

export const SALE_CANCELED_EVENT_NAME = 'SaleCanceled';

export type SaleCanceledPreviousStatus = 'OPEN' | 'PAID' | 'COMPLETED';

export interface SaleCanceledEventItemPayload {
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface SaleCanceledEventPayload extends TenantScoped {
  saleId: string;
  sessionId: string;
  registerId: string;
  operatorId: string;
  previousStatus: SaleCanceledPreviousStatus;
  paymentMethod: SalePaymentMethod | null;
  paidAmount: number | null;
  changeAmount: number | null;
  totalItemsQuantity: number;
  subtotal: number;
  total: number;
  cancellationReason: string;
  canceledAt: string;
  items: SaleCanceledEventItemPayload[];
}

export function createSaleCanceledEvent(
  payload: SaleCanceledEventPayload
): EventEnvelope<SaleCanceledEventPayload> {
  return createEventEnvelope({
    eventName: SALE_CANCELED_EVENT_NAME,
    topic: KafkaTopics.checkout.saleCanceled,
    aggregateId: payload.saleId,
    payload
  });
}
