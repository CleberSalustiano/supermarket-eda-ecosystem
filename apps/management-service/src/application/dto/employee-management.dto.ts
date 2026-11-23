import type { EmployeeRole } from '@supermarket/shared-domain';

import type { EmployeeStatusFilter } from '#/domain/repositories/employee.repository';

export interface EmployeeViewDto {
  employeeId: string;
  tenantId: string;
  employeeCode: string;
  fullName: string;
  role: EmployeeRole;
  active: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListEmployeesInputDto {
  tenantId: string;
  status?: EmployeeStatusFilter;
  limit?: number;
  offset?: number;
}

export interface ListEmployeesOutputDto {
  items: EmployeeViewDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface DeactivateEmployeeInputDto {
  tenantId: string;
  employeeId: string;
}

export interface ChangeEmployeePinInputDto {
  tenantId: string;
  employeeId: string;
  pin: string;
}

export interface ChangeEmployeePinOutputDto {
  employeeId: string;
  tenantId: string;
  employeeCode: string;
  pinChangedAt: string;
}
