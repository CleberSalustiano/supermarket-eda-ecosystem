import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  DomainValidationError
} from '@supermarket/shared-domain';

import type {
  ConsolidateCompletedSaleInputDto,
  ConsolidateCompletedSaleOutputDto
} from '../dto/consolidate-completed-sale.dto';
import type { ManagementTransactionRunnerPort } from '../ports/management-transaction-runner.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '../ports/management-transaction-runner.port';
import { DailyFinancialConsolidation } from '#/domain/entities/daily-financial-consolidation.entity';
import { FinancialEntry } from '#/domain/entities/financial-entry.entity';

@Injectable()
export class ConsolidateCompletedSaleUseCase {
  constructor(
    @Inject(MANAGEMENT_TRANSACTION_RUNNER)
    private readonly transactionRunner: ManagementTransactionRunnerPort
  ) {}

  async execute(
    input: ConsolidateCompletedSaleInputDto
  ): Promise<ConsolidateCompletedSaleOutputDto> {
    const completedAt = ensureDateFromIsoString(input.event.payload.completedAt, 'Completed at');
    const businessDate = completedAt.toISOString().slice(0, 10);
    const financialEntry = FinancialEntry.recordSaleRevenue({
      id: randomUUID(),
      tenantId: input.event.tenantId,
      sourceEventId: input.event.eventId,
      saleId: input.event.payload.saleId,
      paymentMethod: input.event.payload.paymentMethod,
      businessDate,
      grossAmount: input.event.payload.total,
      totalItemsQuantity: input.event.payload.totalItemsQuantity,
      occurredAt: completedAt
    });
    const consolidation = DailyFinancialConsolidation.initialize({
      tenantId: input.event.tenantId,
      businessDate,
      createdAt: completedAt,
      updatedAt: completedAt
    });

    consolidation.applyFinancialEntry(financialEntry, completedAt);

    const entryState = financialEntry.toPrimitives();

    return this.transactionRunner.execute(
      async ({ dailyFinancialConsolidationRepository, financialEntryRepository }) => {
        const inserted = await financialEntryRepository.saveIfAbsent(financialEntry);

        if (!inserted) {
          return {
            saleId: input.event.payload.saleId,
            tenantId: input.event.tenantId,
            businessDate,
            processingStatus: 'ignored',
            financialEntryId: null
          };
        }

        await dailyFinancialConsolidationRepository.accumulate(consolidation);

        return {
          saleId: input.event.payload.saleId,
          tenantId: input.event.tenantId,
          businessDate,
          processingStatus: 'processed',
          financialEntryId: entryState.id
        };
      }
    );
  }
}

function ensureDateFromIsoString(value: string, label: string): Date {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new DomainValidationError(`${label} cannot be empty`);
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new DomainValidationError(`${label} is invalid`);
  }

  return parsedDate;
}
