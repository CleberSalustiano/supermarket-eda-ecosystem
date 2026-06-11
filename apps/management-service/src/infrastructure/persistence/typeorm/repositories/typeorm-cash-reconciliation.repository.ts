import type { CashReconciliationRepositoryPort } from '#/domain/repositories/cash-reconciliation.repository';
import type { CashReconciliation } from '#/domain/entities/cash-reconciliation.entity';
import { CashReconciliationTypeormEntity } from '../entities/cash-reconciliation.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormCashReconciliationRepository implements CashReconciliationRepositoryPort {
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async saveIfAbsent(reconciliation: CashReconciliation): Promise<boolean> {
    const reconciliationState = reconciliation.toPrimitives();
    const existing = await this.repositoryAccessor
      .getRepository(CashReconciliationTypeormEntity)
      .findOne({
        where: [
          {
            sourceEventId: reconciliationState.sourceEventId
          },
          {
            tenantId: reconciliationState.tenantId,
            sessionId: reconciliationState.sessionId
          }
        ]
      });

    if (existing) {
      return false;
    }

    await this.repositoryAccessor.getRepository(CashReconciliationTypeormEntity).save({
      id: reconciliationState.id,
      tenantId: reconciliationState.tenantId,
      sourceEventId: reconciliationState.sourceEventId,
      sessionId: reconciliationState.sessionId,
      registerId: reconciliationState.registerId,
      operatorId: reconciliationState.operatorId,
      businessDate: reconciliationState.businessDate,
      openingFloatAmount: reconciliationState.openingFloatAmount,
      declaredCashAmount: reconciliationState.declaredCashAmount,
      expectedCashAmount: reconciliationState.expectedCashAmount,
      differenceAmount: reconciliationState.differenceAmount,
      status: reconciliationState.status,
      closedAt: new Date(reconciliationState.closedAt),
      createdAt: new Date(reconciliationState.createdAt),
      updatedAt: new Date(reconciliationState.updatedAt)
    });

    return true;
  }
}
