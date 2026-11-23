import { Transform, Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested
} from 'class-validator';

export class CancelSaleManagerApprovalRequestDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  employeeCode!: string;

  @IsString()
  @Matches(/^\d{4,12}$/, { message: '$property must contain 4 to 12 digits' })
  pin!: string;
}

export class CancelSaleRequestDto {
  @IsUUID('4')
  tenantId!: string;

  @IsString()
  @MaxLength(255)
  reason!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CancelSaleManagerApprovalRequestDto)
  managerApproval?: CancelSaleManagerApprovalRequestDto;
}
