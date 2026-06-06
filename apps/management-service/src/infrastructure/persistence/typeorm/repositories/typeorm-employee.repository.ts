import type { EmployeeRepositoryPort } from '../../../../domain/repositories/employee.repository';
import { Employee } from '../../../../domain/entities/employee.entity';
import { EmployeeTypeormEntity } from '../entities/employee.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormEmployeeRepository implements EmployeeRepositoryPort {
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async findByEmployeeCode(tenantId: string, employeeCode: string): Promise<Employee | null> {
    const entity = await this.repositoryAccessor.getRepository(EmployeeTypeormEntity).findOne({
      where: {
        tenantId,
        employeeCode: employeeCode.trim().toUpperCase()
      }
    });

    return entity === null ? null : toDomain(entity);
  }

  async save(employee: Employee): Promise<void> {
    const employeeState = employee.toPrimitives();

    await this.repositoryAccessor.getRepository(EmployeeTypeormEntity).save({
      id: employeeState.id,
      tenantId: employeeState.tenantId,
      employeeCode: employeeState.employeeCode,
      fullName: employeeState.fullName,
      role: employeeState.role,
      pinHash: employeeState.pinHash,
      active: employeeState.active,
      createdAt: new Date(employeeState.createdAt),
      updatedAt: new Date(employeeState.updatedAt)
    });
  }
}

function toDomain(entity: EmployeeTypeormEntity): Employee {
  return Employee.rehydrate({
    id: entity.id,
    tenantId: entity.tenantId,
    employeeCode: entity.employeeCode,
    fullName: entity.fullName,
    role: entity.role,
    pinHash: entity.pinHash,
    active: entity.active,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  });
}
