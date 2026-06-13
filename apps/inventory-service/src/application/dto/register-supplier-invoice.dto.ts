import type { IntegrationEventPublicationStatus } from './integration-event-publication-status';

export interface RegisterSupplierInvoiceItemInputDto {
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  quantity: number;
  unitCost: number;
}

export interface RegisterSupplierInvoiceInputDto {
  tenantId: string;
  supplierReference: string;
  receivedAt?: string;
  items: RegisterSupplierInvoiceItemInputDto[];
}

export interface RegisterSupplierInvoiceReceiptItemOutputDto {
  productId: string;
  quantity: number;
  unitCost: number;
  lineCost: number;
  onHandQuantity: number;
  averageUnitCost: number;
  stockMovementId: string;
}

export interface RegisterSupplierInvoiceOutputDto {
  invoiceId: string;
  tenantId: string;
  supplierReference: string;
  receivedAt: string;
  totalItemsQuantity: number;
  totalCost: number;
  items: RegisterSupplierInvoiceReceiptItemOutputDto[];
  eventPublicationStatus: IntegrationEventPublicationStatus;
}
