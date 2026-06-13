import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

export class RegisterPhysicalInventoryAdjustmentRequestDto {
  @IsUUID('4')
  tenantId!: string;

  @IsUUID('4')
  productId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(64)
  barcode!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(16)
  unitOfMeasure!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  countedQuantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  minimumThreshold?: number;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason!: string;

  @IsUUID('4')
  collectorId!: string;

  @IsOptional()
  @IsString()
  occurredAt?: string;
}
