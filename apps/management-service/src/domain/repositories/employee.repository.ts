import type { Employee } from '../entities/employee.entity';

export interface EmployeeRepositoryPort {
  findByEmployeeCode(tenantId: string, employeeCode: string): Promise<Employee | null>;
  save(employee: Employee): Promise<void>;
}
