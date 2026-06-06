import { IsEnum, IsString, IsUUID, MaxLength, MinLength, Matches } from 'class-validator';

import { EmployeeRole } from '@supermarket/shared-domain';

export class RegisterEmployeeRequestDto {
  @IsUUID('4')
  tenantId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(32)
  employeeCode!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName!: string;

  @IsEnum(EmployeeRole)
  role!: EmployeeRole;

  @Matches(/^\d{4,12}$/)
  pin!: string;
}
