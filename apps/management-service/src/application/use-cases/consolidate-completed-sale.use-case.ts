import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  SALE_CANCELED_EVENT_NAME,
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
import { ProcessedEvent } from '#/domain/entities/processed-event.entity';

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
      sessionId: input.event.payload.sessionId,
      registerId: input.event.payload.registerId,
      operatorId: input.event.payload.operatorId,
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
      async ({
        dailyFinancialConsolidationRepository,
        financialEntryRepository,
        processedEventRepository
      }) => {
        const existingProcessedEvent = await processedEventRepository.findByEventId(
          input.event.eventId
        );

        if (existingProcessedEvent) {
          return {
            saleId: input.event.payload.saleId,
            tenantId: input.event.tenantId,
            businessDate,
            processingStatus: 'ignored',
            financialEntryId: null
          };
        }

        const existingSaleCancellation = await processedEventRepository.findByAggregateIdAndEventName(
          input.event.tenantId,
          input.event.aggregateId,
          SALE_CANCELED_EVENT_NAME
        );

        if (existingSaleCancellation) {
          await processedEventRepository.save(createProcessedEvent(input.event));

          return {
            saleId: input.event.payload.saleId,
            tenantId: input.event.tenantId,
            businessDate,
            processingStatus: 'skipped',
            financialEntryId: null
          };
        }

        const inserted = await financialEntryRepository.saveIfAbsent(financialEntry);

        if (!inserted) {
          await processedEventRepository.save(createProcessedEvent(input.event));

          return {
            saleId: input.event.payload.saleId,
            tenantId: input.event.tenantId,
            businessDate,
            processingStatus: 'ignored',
            financialEntryId: null
          };
        }

        await dailyFinancialConsolidationRepository.accumulate(consolidation);
        await processedEventRepository.save(createProcessedEvent(input.event));

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

function createProcessedEvent(
  event: ConsolidateCompletedSaleInputDto['event']
): ProcessedEvent {
  return ProcessedEvent.record({
    eventId: event.eventId,
    eventName: event.eventName,
    aggregateId: event.aggregateId,
    tenantId: event.tenantId,
    processedAt: new Date()
  });
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
