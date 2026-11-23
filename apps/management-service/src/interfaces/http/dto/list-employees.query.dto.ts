import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import type { EmployeeStatusFilter } from '#/domain/repositories/employee.repository';

export class ListEmployeesQueryDto {
  @IsUUID('4')
  tenantId!: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  status?: EmployeeStatusFilter;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
