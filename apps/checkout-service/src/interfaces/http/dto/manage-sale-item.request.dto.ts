import { IsInt, IsString, IsUUID, Min } from 'class-validator';

export class ManageSaleItemRequestDto {
  @IsUUID('4')
  tenantId!: string;

  @IsString()
  barcode!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
