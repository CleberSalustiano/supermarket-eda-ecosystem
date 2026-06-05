import { IsNumber, IsUUID, Min } from 'class-validator';

export class UpdateProductPriceRequestDto {
  @IsUUID('4')
  tenantId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price!: number;
}
