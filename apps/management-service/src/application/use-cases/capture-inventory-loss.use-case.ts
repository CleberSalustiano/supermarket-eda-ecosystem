import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  DomainValidationError,
  ResourceNotFoundError
} from '@supermarket/shared-domain';

import type {
  CaptureInventoryLossInputDto,
  CaptureInventoryLossOutputDto
} from '../dto/capture-inventory-loss.dto';
import type { ManagementTransactionRunnerPort } from '../ports/management-transaction-runner.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '../ports/management-transaction-runner.port';
import { InventoryLossEntry } from '#/domain/entities/inventory-loss-entry.entity';
import { ProcessedEvent } from '#/domain/entities/processed-event.entity';

@Injectable()
export class CaptureInventoryLossUseCase {
  constructor(
    @Inject(MANAGEMENT_TRANSACTION_RUNNER)
    private readonly transactionRunner: ManagementTransactionRunnerPort
  ) {}

  async execute(
    input: CaptureInventoryLossInputDto
  ): Promise<CaptureInventoryLossOutputDto> {
    const { event } = input;
    const occurredAt = ensureDateFromIsoString(event.payload.recordedAt, 'Recorded at');
    const businessDate = occurredAt.toISOString().slice(0, 10);

    return this.transactionRunner.execute(
      async ({ inventoryLossEntryRepository, processedEventRepository, productRepository }) => {
        const existingProcessedEvent = await processedEventRepository.findByEventId(event.eventId);

        if (existingProcessedEvent) {
          return {
            lossId: event.payload.lossId,
            tenantId: event.tenantId,
            businessDate,
            processingStatus: 'ignored',
            inventoryLossEntryId: null
          };
        }

        const product = await productRepository.findById(event.tenantId, event.payload.productId);

        if (!product) {
          throw new ResourceNotFoundError(
            `Product ${event.payload.productId} was not found for tenant ${event.tenantId}`
          );
        }

        const productState = product.toPrimitives();
        const inventoryLossEntry = InventoryLossEntry.record({
          id: randomUUID(),
          tenantId: event.tenantId,
          sourceEventId: event.eventId,
          lossId: event.payload.lossId,
          productId: event.payload.productId,
          barcode: event.payload.barcode,
          name: event.payload.name,
          unitOfMeasure: event.payload.unitOfMeasure,
          quantity: event.payload.quantity,
          reasonCode: event.payload.reasonCode,
          notes: event.payload.notes,
          businessDate,
          unitPrice: productState.currentPrice,
          occurredAt
        });
        const lossEntryState = inventoryLossEntry.toPrimitives();
        const inserted = await inventoryLossEntryRepository.saveIfAbsent(inventoryLossEntry);

        await processedEventRepository.save(createProcessedEvent(event));

        if (!inserted) {
          return {
            lossId: event.payload.lossId,
            tenantId: event.tenantId,
            businessDate,
            processingStatus: 'ignored',
            inventoryLossEntryId: null
          };
        }

        return {
          lossId: event.payload.lossId,
          tenantId: event.tenantId,
          businessDate,
          processingStatus: 'processed',
          inventoryLossEntryId: lossEntryState.id
        };
      }
    );
  }
}

function createProcessedEvent(event: CaptureInventoryLossInputDto['event']): ProcessedEvent {
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
