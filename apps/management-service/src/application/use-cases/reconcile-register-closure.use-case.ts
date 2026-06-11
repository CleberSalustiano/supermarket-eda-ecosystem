import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import { DomainValidationError, REGISTER_CLOSED_EVENT_NAME } from '@supermarket/shared-domain';

import type {
  ReconcileRegisterClosureInputDto,
  ReconcileRegisterClosureOutputDto
} from '../dto/reconcile-register-closure.dto';
import type { ManagementTransactionRunnerPort } from '../ports/management-transaction-runner.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '../ports/management-transaction-runner.port';
import { CashReconciliation } from '#/domain/entities/cash-reconciliation.entity';
import { ProcessedEvent } from '#/domain/entities/processed-event.entity';

@Injectable()
export class ReconcileRegisterClosureUseCase {
  constructor(
    @Inject(MANAGEMENT_TRANSACTION_RUNNER)
    private readonly transactionRunner: ManagementTransactionRunnerPort
  ) {}

  async execute(
    input: ReconcileRegisterClosureInputDto
  ): Promise<ReconcileRegisterClosureOutputDto> {
    const closedAt = ensureDateFromIsoString(input.event.payload.closedAt, 'Closed at');
    const businessDate = closedAt.toISOString().slice(0, 10);

    return this.transactionRunner.execute(
      async ({
        cashReconciliationRepository,
        financialEntryRepository,
        processedEventRepository
      }) => {
        const existingProcessedEvent = await processedEventRepository.findByEventId(
          input.event.eventId
        );

        if (existingProcessedEvent) {
          return {
            sessionId: input.event.payload.sessionId,
            tenantId: input.event.tenantId,
            businessDate,
            processingStatus: 'ignored',
            cashReconciliationId: null,
            expectedCashAmount: null,
            differenceAmount: null,
            reconciliationStatus: null
          };
        }

        const existingRegisterClosure = await processedEventRepository.findByAggregateIdAndEventName(
          input.event.tenantId,
          input.event.aggregateId,
          REGISTER_CLOSED_EVENT_NAME
        );

        if (existingRegisterClosure) {
          await processedEventRepository.save(createProcessedEvent(input.event));

          return {
            sessionId: input.event.payload.sessionId,
            tenantId: input.event.tenantId,
            businessDate,
            processingStatus: 'skipped',
            cashReconciliationId: null,
            expectedCashAmount: null,
            differenceAmount: null,
            reconciliationStatus: null
          };
        }

        const expectedSalesCashAmount = await financialEntryRepository.sumNetCashMovementBySession(
          input.event.tenantId,
          input.event.payload.sessionId
        );
        const expectedCashAmount = Number.parseFloat(
          (input.event.payload.openingFloatAmount + expectedSalesCashAmount).toFixed(2)
        );
        const reconciliation = CashReconciliation.reconcile({
          id: randomUUID(),
          tenantId: input.event.tenantId,
          sourceEventId: input.event.eventId,
          sessionId: input.event.payload.sessionId,
          registerId: input.event.payload.registerId,
          operatorId: input.event.payload.operatorId,
          businessDate,
          openingFloatAmount: input.event.payload.openingFloatAmount,
          declaredCashAmount: input.event.payload.declaredCashAmount,
          expectedCashAmount,
          closedAt
        });
        const reconciliationState = reconciliation.toPrimitives();
        const inserted = await cashReconciliationRepository.saveIfAbsent(reconciliation);

        await processedEventRepository.save(createProcessedEvent(input.event));

        if (!inserted) {
          return {
            sessionId: input.event.payload.sessionId,
            tenantId: input.event.tenantId,
            businessDate,
            processingStatus: 'ignored',
            cashReconciliationId: null,
            expectedCashAmount: null,
            differenceAmount: null,
            reconciliationStatus: null
          };
        }

        return {
          sessionId: input.event.payload.sessionId,
          tenantId: input.event.tenantId,
          businessDate,
          processingStatus: 'processed',
          cashReconciliationId: reconciliationState.id,
          expectedCashAmount: reconciliationState.expectedCashAmount,
          differenceAmount: reconciliationState.differenceAmount,
          reconciliationStatus: reconciliationState.status
        };
      }
    );
  }
}

function createProcessedEvent(event: ReconcileRegisterClosureInputDto['event']): ProcessedEvent {
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
