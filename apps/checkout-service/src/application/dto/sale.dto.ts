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
  totalItemsQuantity: number;
  subtotal: number;
  total: number;
  items: SaleItemOutputDto[];
  createdAt: string;
  updatedAt: string;
}

export function toSaleOutputDto(sale: Sale): SaleOutputDto {
  const saleState = sale.toPrimitives();

  return {
    saleId: saleState.id,
    tenantId: saleState.tenantId,
    sessionId: saleState.sessionId,
    status: saleState.status,
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
