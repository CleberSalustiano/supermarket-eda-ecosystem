import type { FinancialEntryRepositoryPort } from '#/domain/repositories/financial-entry.repository';
import { FinancialEntryTypeormEntity } from '../entities/financial-entry.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';
import type { FinancialEntry } from '#/domain/entities/financial-entry.entity';

export class TypeormFinancialEntryRepository implements FinancialEntryRepositoryPort {
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async saveIfAbsent(entry: FinancialEntry): Promise<boolean> {
    const entryState = entry.toPrimitives();
    const existingEntry = await this.repositoryAccessor
      .getRepository(FinancialEntryTypeormEntity)
      .findOne({
        where: {
          sourceEventId: entryState.sourceEventId
        }
      });

    if (existingEntry) {
      return false;
    }

    await this.repositoryAccessor.getRepository(FinancialEntryTypeormEntity).save({
      id: entryState.id,
      tenantId: entryState.tenantId,
      entryType: entryState.entryType,
      sourceEventId: entryState.sourceEventId,
      saleId: entryState.saleId,
      paymentMethod: entryState.paymentMethod,
      businessDate: entryState.businessDate,
      grossAmount: entryState.grossAmount,
      totalItemsQuantity: entryState.totalItemsQuantity,
      occurredAt: new Date(entryState.occurredAt),
      createdAt: new Date(entryState.createdAt)
    });

    return true;
  }
}
