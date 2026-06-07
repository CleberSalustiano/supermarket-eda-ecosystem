export interface ScanProductByBarcodeInputDto {
  tenantId: string;
  barcode: string;
}

export interface ScanProductByBarcodeOutputDto {
  productId: string;
  tenantId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  unitPrice: number;
  active: boolean;
  priceUpdatedAt: string;
}
