import { IsEnum, IsNumber, IsUUID, Min } from 'class-validator';

import { SalePaymentMethod } from '@supermarket/shared-domain';

export class ProcessSalePaymentRequestDto {
  @IsUUID('4')
  tenantId!: string;

  @IsEnum(SalePaymentMethod)
  paymentMethod!: SalePaymentMethod;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  paidAmount!: number;
}
