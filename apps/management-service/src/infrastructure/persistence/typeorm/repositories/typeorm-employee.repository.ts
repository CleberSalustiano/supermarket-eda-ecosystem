import type {
  EmployeeListQuery,
  EmployeeListResult,
  EmployeeRepositoryPort
} from '#/domain/repositories/employee.repository';
import { Employee } from '#/domain/entities/employee.entity';
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

    return entity ? toDomain(entity) : null;
  }

  async findById(tenantId: string, employeeId: string): Promise<Employee | null> {
    const entity = await this.repositoryAccessor
      .getRepository(EmployeeTypeormEntity)
      .findOne({ where: { tenantId, id: employeeId } });

    return entity ? toDomain(entity) : null;
  }

  async list(tenantId: string, query: EmployeeListQuery): Promise<EmployeeListResult> {
    const [entities, total] = await this.repositoryAccessor
      .getRepository(EmployeeTypeormEntity)
      .findAndCount({
        where: {
          tenantId,
          ...(query.status === 'all' ? {} : { active: query.status === 'active' })
        },
        order: { employeeCode: 'ASC' },
        take: query.limit,
        skip: query.offset
      });

    return { items: entities.map(toDomain), total };
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
      deactivatedAt:
        employeeState.deactivatedAt === null ? null : new Date(employeeState.deactivatedAt),
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
    deactivatedAt: entity.deactivatedAt,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  });
}
