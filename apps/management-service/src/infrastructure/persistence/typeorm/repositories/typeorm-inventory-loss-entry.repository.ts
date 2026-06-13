import type {
  InventoryLossEntryBusinessDateSummary,
  InventoryLossEntryRepositoryPort
} from '#/domain/repositories/inventory-loss-entry.repository';
import { InventoryLossEntry } from '#/domain/entities/inventory-loss-entry.entity';
import { InventoryLossEntryTypeormEntity } from '../entities/inventory-loss-entry.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormInventoryLossEntryRepository
  implements InventoryLossEntryRepositoryPort
{
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async saveIfAbsent(entry: InventoryLossEntry): Promise<boolean> {
    const entryState = entry.toPrimitives();
    const existingEntry = await this.repositoryAccessor
      .getRepository(InventoryLossEntryTypeormEntity)
      .findOne({
        where: {
          sourceEventId: entryState.sourceEventId
        }
      });

    if (existingEntry) {
      return false;
    }

    await this.repositoryAccessor.getRepository(InventoryLossEntryTypeormEntity).save({
      id: entryState.id,
      tenantId: entryState.tenantId,
      sourceEventId: entryState.sourceEventId,
      lossId: entryState.lossId,
      productId: entryState.productId,
      barcode: entryState.barcode,
      name: entryState.name,
      unitOfMeasure: entryState.unitOfMeasure,
      quantity: entryState.quantity,
      reasonCode: entryState.reasonCode,
      notes: entryState.notes,
      businessDate: entryState.businessDate,
      unitPrice: entryState.unitPrice,
      totalLossAmount: entryState.totalLossAmount,
      occurredAt: new Date(entryState.occurredAt),
      createdAt: new Date(entryState.createdAt)
    });

    return true;
  }

  async summarizeByBusinessDateRange(
    tenantId: string,
    fromDate: string,
    toDate: string
  ): Promise<InventoryLossEntryBusinessDateSummary[]> {
    const rows = (await this.repositoryAccessor
      .getRepository(InventoryLossEntryTypeormEntity)
      .createQueryBuilder('inventoryLossEntry')
      .select('"inventoryLossEntry"."businessDate"', 'businessDate')
      .addSelect(
        'COALESCE(SUM("inventoryLossEntry"."totalLossAmount"), 0)',
        'lossAmountTotal'
      )
      .addSelect(
        'COALESCE(SUM("inventoryLossEntry"."quantity"), 0)',
        'lossItemsQuantity'
      )
      .addSelect('COUNT(*)', 'lossEventsCount')
      .where('"inventoryLossEntry"."tenantId" = :tenantId', { tenantId })
      .andWhere('"inventoryLossEntry"."businessDate" BETWEEN :fromDate AND :toDate', {
        fromDate,
        toDate
      })
      .groupBy('"inventoryLossEntry"."businessDate"')
      .orderBy('"inventoryLossEntry"."businessDate"', 'ASC')
      .getRawMany()) as Array<{
      businessDate: string | Date;
      lossAmountTotal: string | number;
      lossItemsQuantity: string | number;
      lossEventsCount: string | number;
    }>;

    return rows.map((row) => ({
      businessDate: normalizeBusinessDateValue(row.businessDate),
      lossAmountTotal: Number.parseFloat(Number(row.lossAmountTotal).toFixed(2)),
      lossItemsQuantity: Number.parseInt(String(row.lossItemsQuantity), 10),
      lossEventsCount: Number.parseInt(String(row.lossEventsCount), 10)
    }));
  }
}

function normalizeBusinessDateValue(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.trim();
}
