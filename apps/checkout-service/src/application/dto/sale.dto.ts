import { SalePaymentMethod } from '@supermarket/shared-domain';
import { DomainValidationError } from '@supermarket/shared-domain';

import type { IntegrationEventPublicationStatus } from './integration-event-publication-status';
import type { Sale, SaleStatus } from '#/domain/entities/sale.entity';

export interface StartSaleInputDto {
  tenantId: string;
  sessionId: string;
}

export interface AddSaleItemInputDto {
  tenantId: string;
  saleId: string;
  barcode: string;
  quantity: number;
}

export interface RemoveSaleItemInputDto {
  tenantId: string;
  saleId: string;
  barcode: string;
  quantity: number;
}

export interface ProcessSalePaymentInputDto {
  tenantId: string;
  saleId: string;
  paymentMethod: SalePaymentMethod;
  paidAmount: number;
}

export interface CompleteSaleInputDto {
  tenantId: string;
  saleId: string;
}

export interface CancelSaleInputDto {
  tenantId: string;
  saleId: string;
  reason: string;
  managerApprovalCode?: string;
}

export interface SaleItemOutputDto {
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface SaleOutputDto {
  saleId: string;
  tenantId: string;
  sessionId: string;
  status: SaleStatus;
  paymentMethod: SalePaymentMethod | null;
  paidAmount: number | null;
  changeAmount: number | null;
  paidAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  cancellationReason: string | null;
  totalItemsQuantity: number;
  subtotal: number;
  total: number;
  items: SaleItemOutputDto[];
  createdAt: string;
  updatedAt: string;
}

export interface SaleReceiptOutputDto {
  saleId: string;
  tenantId: string;
  sessionId: string;
  paymentMethod: SalePaymentMethod;
  paidAmount: number;
  changeAmount: number;
  totalItemsQuantity: number;
  total: number;
  completedAt: string;
  issuedAt: string;
  items: SaleItemOutputDto[];
}

export interface CompleteSaleOutputDto extends SaleOutputDto {
  eventPublicationStatus: IntegrationEventPublicationStatus;
  receipt: SaleReceiptOutputDto;
}

export interface CancelSaleOutputDto extends SaleOutputDto {
  eventPublicationStatus: IntegrationEventPublicationStatus;
}

export function toSaleOutputDto(sale: Sale): SaleOutputDto {
  const saleState = sale.toPrimitives();

  return {
    saleId: saleState.id,
    tenantId: saleState.tenantId,
    sessionId: saleState.sessionId,
    status: saleState.status,
    paymentMethod: saleState.paymentMethod,
    paidAmount: saleState.paidAmount,
    changeAmount: saleState.changeAmount,
    paidAt: saleState.paidAt,
    completedAt: saleState.completedAt,
    canceledAt: saleState.canceledAt,
    cancellationReason: saleState.cancellationReason,
    totalItemsQuantity: saleState.totalItemsQuantity,
    subtotal: saleState.subtotal,
    total: saleState.total,
    items: saleState.items.map((item) => ({
      productId: item.productId,
      barcode: item.barcode,
      name: item.name,
      unitOfMeasure: item.unitOfMeasure,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal
    })),
    createdAt: saleState.createdAt,
    updatedAt: saleState.updatedAt
  };
}

export function toCompleteSaleOutputDto(
  sale: Sale,
  eventPublicationStatus: IntegrationEventPublicationStatus
): CompleteSaleOutputDto {
  const saleOutput = toSaleOutputDto(sale);

  if (
    !saleOutput.paymentMethod ||
    saleOutput.paidAmount === null ||
    saleOutput.changeAmount === null ||
    !saleOutput.completedAt
  ) {
    throw new DomainValidationError(
      `Sale ${saleOutput.saleId} is missing receipt data after completion`
    );
  }

  return {
    ...saleOutput,
    eventPublicationStatus,
    receipt: {
      saleId: saleOutput.saleId,
      tenantId: saleOutput.tenantId,
      sessionId: saleOutput.sessionId,
      paymentMethod: saleOutput.paymentMethod,
      paidAmount: saleOutput.paidAmount,
      changeAmount: saleOutput.changeAmount,
      totalItemsQuantity: saleOutput.totalItemsQuantity,
      total: saleOutput.total,
      completedAt: saleOutput.completedAt,
      issuedAt: saleOutput.completedAt,
      items: saleOutput.items
    }
  };
}

export function toCancelSaleOutputDto(
  sale: Sale,
  eventPublicationStatus: IntegrationEventPublicationStatus
): CancelSaleOutputDto {
  return {
    ...toSaleOutputDto(sale),
    eventPublicationStatus
  };
}
