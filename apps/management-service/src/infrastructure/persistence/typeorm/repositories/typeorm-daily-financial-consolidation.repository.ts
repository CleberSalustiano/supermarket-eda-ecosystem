import type { DailyFinancialConsolidationRepositoryPort } from '#/domain/repositories/daily-financial-consolidation.repository';
import type { DailyFinancialConsolidation } from '#/domain/entities/daily-financial-consolidation.entity';
import { DailyFinancialConsolidationTypeormEntity } from '../entities/daily-financial-consolidation.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormDailyFinancialConsolidationRepository
  implements DailyFinancialConsolidationRepositoryPort
{
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async accumulate(consolidation: DailyFinancialConsolidation): Promise<void> {
    const consolidationState = consolidation.toPrimitives();

    await this.repositoryAccessor.getRepository(DailyFinancialConsolidationTypeormEntity).query(
      `
        INSERT INTO "daily_financial_consolidations" (
          "tenantId",
          "businessDate",
          "grossSalesTotal",
          "salesCount",
          "soldItemsQuantity",
          "lastConsolidatedAt",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT ("tenantId", "businessDate") DO UPDATE SET
          "grossSalesTotal" = "daily_financial_consolidations"."grossSalesTotal" + EXCLUDED."grossSalesTotal",
          "salesCount" = "daily_financial_consolidations"."salesCount" + EXCLUDED."salesCount",
          "soldItemsQuantity" = "daily_financial_consolidations"."soldItemsQuantity" + EXCLUDED."soldItemsQuantity",
          "lastConsolidatedAt" = CASE
            WHEN "daily_financial_consolidations"."lastConsolidatedAt" >= EXCLUDED."lastConsolidatedAt"
              THEN "daily_financial_consolidations"."lastConsolidatedAt"
            ELSE EXCLUDED."lastConsolidatedAt"
          END,
          "updatedAt" = EXCLUDED."updatedAt"
      `,
      [
        consolidationState.tenantId,
        consolidationState.businessDate,
        consolidationState.grossSalesTotal,
        consolidationState.salesCount,
        consolidationState.soldItemsQuantity,
        new Date(consolidationState.lastConsolidatedAt),
        new Date(consolidationState.createdAt),
        new Date(consolidationState.updatedAt)
      ]
    );
  }
}
