import { IsNumber, IsUUID, Min } from 'class-validator';

export class ClosePosSessionRequestDto {
  @IsUUID('4')
  tenantId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  declaredCashAmount!: number;
}
