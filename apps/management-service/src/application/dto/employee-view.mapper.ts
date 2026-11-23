import type { Employee } from '#/domain/entities/employee.entity';
import type { EmployeeViewDto } from './employee-management.dto';

/** Maps an employee to its public view. The PIN hash is intentionally never part of it. */
export function toEmployeeViewDto(employee: Employee): EmployeeViewDto {
  const state = employee.toPrimitives();

  return {
    employeeId: state.id,
    tenantId: state.tenantId,
    employeeCode: state.employeeCode,
    fullName: state.fullName,
    role: state.role,
    active: state.active,
    deactivatedAt: state.deactivatedAt,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt
  };
}
