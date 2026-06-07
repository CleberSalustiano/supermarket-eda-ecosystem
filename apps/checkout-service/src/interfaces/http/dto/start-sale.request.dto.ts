import { IsUUID } from 'class-validator';

export class StartSaleRequestDto {
  @IsUUID('4')
  tenantId!: string;

  @IsUUID('4')
  sessionId!: string;
}
