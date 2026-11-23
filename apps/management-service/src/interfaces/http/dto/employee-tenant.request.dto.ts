import { IsUUID } from 'class-validator';

export class EmployeeTenantRequestDto {
  @IsUUID('4')
  tenantId!: string;
}
