import { SalePaymentMethod } from '@supermarket/shared-domain';

import type {
  FinancialEntryBusinessDateSummary,
  FinancialEntryRepositoryPort
} from '#/domain/repositories/financial-entry.repository';
import { FinancialEntry } from '#/domain/entities/financial-entry.entity';
import { FinancialEntryTypeormEntity } from '../entities/financial-entry.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';
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
      sessionId: entryState.sessionId,
      registerId: entryState.registerId,
      operatorId: entryState.operatorId,
      paymentMethod: entryState.paymentMethod,
      businessDate: entryState.businessDate,
      grossAmount: entryState.grossAmount,
      totalItemsQuantity: entryState.totalItemsQuantity,
      occurredAt: new Date(entryState.occurredAt),
      createdAt: new Date(entryState.createdAt)
    });

    return true;
  }

  async findSaleRevenueBySaleId(tenantId: string, saleId: string): Promise<FinancialEntry | null> {
    const entity = await this.repositoryAccessor.getRepository(FinancialEntryTypeormEntity).findOne({
      where: {
        tenantId,
        saleId,
        entryType: 'SALE_REVENUE'
      }
    });

    return entity ? toDomain(entity) : null;
  }

  async sumNetCashMovementBySession(tenantId: string, sessionId: string): Promise<number> {
    const rawResult = (await this.repositoryAccessor
      .getRepository(FinancialEntryTypeormEntity)
      .createQueryBuilder('financialEntry')
      .select(
        `
          COALESCE(
            SUM(
              CASE
                WHEN "financialEntry"."entryType" = 'SALE_REVENUE' THEN "financialEntry"."grossAmount"
                ELSE "financialEntry"."grossAmount" * -1
              END
            ),
            0
          )
        `,
        'netCashAmount'
      )
      .where('"financialEntry"."tenantId" = :tenantId', { tenantId })
      .andWhere('"financialEntry"."sessionId" = :sessionId', { sessionId })
      .andWhere('"financialEntry"."paymentMethod" = :paymentMethod', {
        paymentMethod: SalePaymentMethod.Cash
      })
      .getRawOne()) as {
      netCashAmount: string | number;
    } | null;

    const value = rawResult?.netCashAmount ?? 0;

    return Number.parseFloat(Number(value).toFixed(2));
  }

  async summarizeByBusinessDateRange(
    tenantId: string,
    fromDate: string,
    toDate: string
  ): Promise<FinancialEntryBusinessDateSummary[]> {
    const rows = (await this.repositoryAccessor
      .getRepository(FinancialEntryTypeormEntity)
      .createQueryBuilder('financialEntry')
      .select('"financialEntry"."businessDate"', 'businessDate')
      .addSelect(
        `
          COALESCE(
            SUM(
              CASE
                WHEN "financialEntry"."entryType" = 'SALE_REVENUE' THEN "financialEntry"."grossAmount"
                ELSE "financialEntry"."grossAmount" * -1
              END
            ),
            0
          )
        `,
        'revenueNetTotal'
      )
      .addSelect(
        `
          COALESCE(
            SUM(
              CASE
                WHEN "financialEntry"."entryType" = 'SALE_REVENUE' THEN 1
                ELSE -1
              END
            ),
            0
          )
        `,
        'netSalesCount'
      )
      .addSelect(
        `
          COALESCE(
            SUM(
              CASE
                WHEN "financialEntry"."entryType" = 'SALE_REVENUE' THEN "financialEntry"."totalItemsQuantity"
                ELSE "financialEntry"."totalItemsQuantity" * -1
              END
            ),
            0
          )
        `,
        'soldItemsQuantity'
      )
      .where('"financialEntry"."tenantId" = :tenantId', { tenantId })
      .andWhere('"financialEntry"."businessDate" BETWEEN :fromDate AND :toDate', {
        fromDate,
        toDate
      })
      .groupBy('"financialEntry"."businessDate"')
      .orderBy('"financialEntry"."businessDate"', 'ASC')
      .getRawMany()) as Array<{
      businessDate: string | Date;
      revenueNetTotal: string | number;
      netSalesCount: string | number;
      soldItemsQuantity: string | number;
    }>;

    return rows.map((row) => ({
      businessDate: normalizeBusinessDateValue(row.businessDate),
      revenueNetTotal: Number.parseFloat(Number(row.revenueNetTotal).toFixed(2)),
      netSalesCount: Number.parseInt(String(row.netSalesCount), 10),
      soldItemsQuantity: Number.parseInt(String(row.soldItemsQuantity), 10)
    }));
  }
}

function toDomain(entity: FinancialEntryTypeormEntity): FinancialEntry {
  if (!entity.sessionId || !entity.registerId || !entity.operatorId) {
    throw new Error(
      `Financial entry ${entity.id} is missing session reconciliation context`
    );
  }

  return FinancialEntry.rehydrate({
    id: entity.id,
    tenantId: entity.tenantId,
    entryType: entity.entryType as 'SALE_REVENUE' | 'SALE_CANCELLATION_REVERSAL',
    sourceEventId: entity.sourceEventId,
    saleId: entity.saleId,
    sessionId: entity.sessionId,
    registerId: entity.registerId,
    operatorId: entity.operatorId,
    paymentMethod: entity.paymentMethod as SalePaymentMethod,
    businessDate: entity.businessDate,
    grossAmount: entity.grossAmount,
    totalItemsQuantity: entity.totalItemsQuantity,
    occurredAt: entity.occurredAt,
    createdAt: entity.createdAt
  });
}

function normalizeBusinessDateValue(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.trim();
}
