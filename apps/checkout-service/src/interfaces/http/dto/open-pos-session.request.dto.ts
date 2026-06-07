import { IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class OpenPosSessionRequestDto {
  @IsUUID('4')
  tenantId!: string;

  @IsString()
  registerId!: string;

  @IsUUID('4')
  operatorId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingFloatAmount!: number;
}
