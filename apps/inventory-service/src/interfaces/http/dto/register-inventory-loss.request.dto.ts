import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

import { InventoryLossReason } from '@supermarket/shared-domain';

export class RegisterInventoryLossRequestDto {
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
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsEnum(InventoryLossReason)
  reasonCode!: InventoryLossReason;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @IsOptional()
  @IsString()
  occurredAt?: string;
}
