import { IsUUID } from 'class-validator';

export class ScanProductByBarcodeQueryDto {
  @IsUUID()
  tenantId!: string;
}
