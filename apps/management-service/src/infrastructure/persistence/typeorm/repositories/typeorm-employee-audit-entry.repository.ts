import type { EmployeeAuditEntry } from '#/domain/entities/employee-audit-entry.entity';
import type { EmployeeAuditEntryRepositoryPort } from '#/domain/repositories/employee-audit-entry.repository';
import { EmployeeAuditEntryTypeormEntity } from '../entities/employee-audit-entry.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormEmployeeAuditEntryRepository implements EmployeeAuditEntryRepositoryPort {
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async append(entry: EmployeeAuditEntry): Promise<void> {
    const state = entry.toPrimitives();

    await this.repositoryAccessor.getRepository(EmployeeAuditEntryTypeormEntity).insert({
      id: state.id,
      tenantId: state.tenantId,
      employeeId: state.employeeId,
      employeeCode: state.employeeCode,
      action: state.action,
      occurredAt: new Date(state.occurredAt)
    });
  }
}
