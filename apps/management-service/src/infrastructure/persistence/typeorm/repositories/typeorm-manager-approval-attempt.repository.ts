import type { ManagerApprovalAttempt } from '#/domain/entities/manager-approval-attempt.entity';
import type { ManagerApprovalAttemptRepositoryPort } from '#/domain/repositories/manager-approval-attempt.repository';
import { ManagerApprovalAttemptTypeormEntity } from '../entities/manager-approval-attempt.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormManagerApprovalAttemptRepository
  implements ManagerApprovalAttemptRepositoryPort
{
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async append(attempt: ManagerApprovalAttempt): Promise<void> {
    const state = attempt.toPrimitives();

    await this.repositoryAccessor.getRepository(ManagerApprovalAttemptTypeormEntity).insert({
      id: state.id,
      tenantId: state.tenantId,
      approverCode: state.approverCode,
      employeeId: state.employeeId,
      registerId: state.registerId,
      saleId: state.saleId,
      outcome: state.outcome,
      reason: state.reason,
      attemptedAt: new Date(state.attemptedAt)
    });
  }
}
