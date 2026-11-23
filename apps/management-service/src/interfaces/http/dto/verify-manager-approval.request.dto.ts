import { IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

import type { ManagerApprovalVerificationRequest } from '@supermarket/shared-domain';

export class VerifyManagerApprovalRequestDto implements ManagerApprovalVerificationRequest {
  @IsUUID('4')
  tenantId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(32)
  approverCode!: string;

  @IsString()
  @Matches(/^\d{4,12}$/)
  pin!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  registerId!: string;

  @IsUUID('4')
  saleId!: string;
}
