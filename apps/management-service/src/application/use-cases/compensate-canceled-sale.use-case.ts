import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  SALE_CANCELED_EVENT_NAME,
  SALE_COMPLETED_EVENT_NAME
} from '@supermarket/shared-domain';

import type {
  CompensateCanceledSaleInputDto,
  CompensateCanceledSaleOutputDto
} from '../dto/compensate-canceled-sale.dto';
import type { ManagementTransactionRunnerPort } from '../ports/management-transaction-runner.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '../ports/management-transaction-runner.port';
import { FinancialEntry } from '#/domain/entities/financial-entry.entity';
import { ProcessedEvent } from '#/domain/entities/processed-event.entity';

@Injectable()
export class CompensateCanceledSaleUseCase {
  constructor(
    @Inject(MANAGEMENT_TRANSACTION_RUNNER)
    private readonly transactionRunner: ManagementTransactionRunnerPort
  ) {}

  async execute(
    input: CompensateCanceledSaleInputDto
  ): Promise<CompensateCanceledSaleOutputDto> {
    const { event } = input;

    return this.transactionRunner.execute(async ({ financialEntryRepository, processedEventRepository }) => {
      const existingProcessedEvent = await processedEventRepository.findByEventId(event.eventId);

      if (existingProcessedEvent) {
        return {
          saleId: event.payload.saleId,
          tenantId: event.tenantId,
          businessDate: null,
          processingStatus: 'ignored',
          financialEntryId: null
        };
      }

      const existingCanceledSale = await processedEventRepository.findByAggregateIdAndEventName(
        event.tenantId,
        event.aggregateId,
        SALE_CANCELED_EVENT_NAME
      );

      if (existingCanceledSale) {
        await processedEventRepository.save(createProcessedEvent(event));

        return {
          saleId: event.payload.saleId,
          tenantId: event.tenantId,
          businessDate: null,
          processingStatus: 'skipped',
          financialEntryId: null
        };
      }

      if (event.payload.previousStatus !== 'COMPLETED') {
        await processedEventRepository.save(createProcessedEvent(event));

        return {
          saleId: event.payload.saleId,
          tenantId: event.tenantId,
          businessDate: null,
          processingStatus: 'skipped',
          financialEntryId: null
        };
      }

      const saleRevenueEntry = await financialEntryRepository.findSaleRevenueBySaleId(
        event.tenantId,
        event.payload.saleId
      );

      if (!saleRevenueEntry) {
        await processedEventRepository.save(createProcessedEvent(event));

        return {
          saleId: event.payload.saleId,
          tenantId: event.tenantId,
          businessDate: null,
          processingStatus: 'skipped',
          financialEntryId: null
        };
      }

      const entryState = saleRevenueEntry.toPrimitives();
      const reversalEntry = FinancialEntry.recordSaleCancellationReversal({
        id: randomUUID(),
        tenantId: event.tenantId,
        sourceEventId: event.eventId,
        saleId: event.payload.saleId,
        sessionId: entryState.sessionId,
        registerId: entryState.registerId,
        operatorId: entryState.operatorId,
        paymentMethod: entryState.paymentMethod,
        businessDate: entryState.businessDate,
        grossAmount: entryState.grossAmount,
        totalItemsQuantity: entryState.totalItemsQuantity,
        occurredAt: new Date(event.occurredAt)
      });
      const reversalState = reversalEntry.toPrimitives();
      const inserted = await financialEntryRepository.saveIfAbsent(reversalEntry);

      await processedEventRepository.save(createProcessedEvent(event));

      if (!inserted) {
        return {
          saleId: event.payload.saleId,
          tenantId: event.tenantId,
          businessDate: entryState.businessDate,
          processingStatus: 'ignored',
          financialEntryId: null
        };
      }

      return {
        saleId: event.payload.saleId,
        tenantId: event.tenantId,
        businessDate: reversalState.businessDate,
        processingStatus: 'processed',
        financialEntryId: reversalState.id
      };
    });
  }
}

function createProcessedEvent(event: CompensateCanceledSaleInputDto['event']): ProcessedEvent {
  return ProcessedEvent.record({
    eventId: event.eventId,
    eventName: event.eventName,
    aggregateId: event.aggregateId,
    tenantId: event.tenantId,
    processedAt: new Date()
  });
}
