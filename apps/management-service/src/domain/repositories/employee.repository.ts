import type { Employee } from '../entities/employee.entity';

export type EmployeeStatusFilter = 'active' | 'inactive' | 'all';

export interface EmployeeListQuery {
  status: EmployeeStatusFilter;
  limit: number;
  offset: number;
}

export interface EmployeeListResult {
  items: Employee[];
  total: number;
}

export interface EmployeeRepositoryPort {
  findByEmployeeCode(tenantId: string, employeeCode: string): Promise<Employee | null>;
  findById(tenantId: string, employeeId: string): Promise<Employee | null>;
  list(tenantId: string, query: EmployeeListQuery): Promise<EmployeeListResult>;
  save(employee: Employee): Promise<void>;
}
