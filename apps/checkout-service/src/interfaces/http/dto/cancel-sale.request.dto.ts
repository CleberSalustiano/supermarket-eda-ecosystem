import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CancelSaleRequestDto {
  @IsUUID('4')
  tenantId!: string;

  @IsString()
  @MaxLength(255)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  managerApprovalCode?: string;
}
