import { IsNumber, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class RegisterProductRequestDto {
  @IsUUID('4')
  tenantId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(64)
  barcode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(16)
  unitOfMeasure!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price!: number;
}
