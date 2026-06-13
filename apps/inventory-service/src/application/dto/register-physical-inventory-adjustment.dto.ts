export interface RegisterPhysicalInventoryAdjustmentInputDto {
  tenantId: string;
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  countedQuantity: number;
  minimumThreshold?: number;
  reason: string;
  collectorId: string;
  occurredAt?: string;
}

export interface RegisterPhysicalInventoryAdjustmentOutputDto {
  adjustmentId: string;
  tenantId: string;
  productId: string;
  quantityDelta: number;
  onHandQuantity: number;
  minimumThreshold: number;
  stockMovementId: string;
}
