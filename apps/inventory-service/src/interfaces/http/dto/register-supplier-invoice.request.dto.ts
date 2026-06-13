import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';

class RegisterSupplierInvoiceItemRequestDto {
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
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  unitCost!: number;
}

export class RegisterSupplierInvoiceRequestDto {
  @IsUUID('4')
  tenantId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(64)
  supplierReference!: string;

  @IsOptional()
  @IsString()
  receivedAt?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RegisterSupplierInvoiceItemRequestDto)
  items!: RegisterSupplierInvoiceItemRequestDto[];
}
