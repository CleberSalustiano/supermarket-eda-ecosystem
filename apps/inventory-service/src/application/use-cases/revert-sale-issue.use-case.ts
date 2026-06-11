import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  ConflictError,
  SALE_CANCELED_EVENT_NAME,
  SALE_COMPLETED_EVENT_NAME
} from '@supermarket/shared-domain';

import type {
  RevertSaleIssueInputDto,
  RevertSaleIssueOutputDto
} from '../dto/revert-sale-issue.dto';
import {
  INVENTORY_TRANSACTION_RUNNER,
  type InventoryTransactionRunnerPort
} from '../ports/inventory-transaction-runner.port';
import { ProcessedEvent } from '#/domain/entities/processed-event.entity';
import { StockMovement } from '#/domain/entities/stock-movement.entity';

@Injectable()
export class RevertSaleIssueUseCase {
  constructor(
    @Inject(INVENTORY_TRANSACTION_RUNNER)
    private readonly transactionRunner: InventoryTransactionRunnerPort
  ) {}

  async execute(input: RevertSaleIssueInputDto): Promise<RevertSaleIssueOutputDto> {
    const { event } = input;

    return this.transactionRunner.execute(
      async ({
        inventoryItemRepository,
        processedEventRepository,
        stockMovementRepository
      }) => {
        const existingProcessedEvent = await processedEventRepository.findByEventId(event.eventId);

        if (existingProcessedEvent) {
          return {
            saleId: event.payload.saleId,
            tenantId: event.tenantId,
            processedEventId: event.eventId,
            processingStatus: 'ignored',
            affectedItemsCount: 0,
            stockMovementCount: 0
          };
        }

        const existingSaleCancellation = await processedEventRepository.findByAggregateIdAndEventName(
          event.tenantId,
          event.aggregateId,
          SALE_CANCELED_EVENT_NAME
        );

        if (existingSaleCancellation) {
          await processedEventRepository.save(createProcessedEvent(event));

          return {
            saleId: event.payload.saleId,
            tenantId: event.tenantId,
            processedEventId: event.eventId,
            processingStatus: 'skipped',
            affectedItemsCount: 0,
            stockMovementCount: 0
          };
        }

        if (event.payload.previousStatus !== 'COMPLETED') {
          await processedEventRepository.save(createProcessedEvent(event));

          return {
            saleId: event.payload.saleId,
            tenantId: event.tenantId,
            processedEventId: event.eventId,
            processingStatus: 'skipped',
            affectedItemsCount: 0,
            stockMovementCount: 0
          };
        }

        const existingSaleIssue = await processedEventRepository.findByAggregateIdAndEventName(
          event.tenantId,
          event.aggregateId,
          SALE_COMPLETED_EVENT_NAME
        );

        if (!existingSaleIssue) {
          await processedEventRepository.save(createProcessedEvent(event));

          return {
            saleId: event.payload.saleId,
            tenantId: event.tenantId,
            processedEventId: event.eventId,
            processingStatus: 'skipped',
            affectedItemsCount: 0,
            stockMovementCount: 0
          };
        }

        for (const item of event.payload.items) {
          const inventoryItem = await inventoryItemRepository.findByProductId(
            event.tenantId,
            item.productId
          );

          if (!inventoryItem) {
            throw new ConflictError(
              `Inventory item ${item.productId} for tenant ${event.tenantId} could not be reverted because the prior sale issue state is missing`
            );
          }

          inventoryItem.revertSaleIssue({
            barcode: item.barcode,
            name: item.name,
            unitOfMeasure: item.unitOfMeasure,
            quantity: item.quantity,
            updatedAt: new Date(event.occurredAt)
          });

          await inventoryItemRepository.save(inventoryItem);
          await stockMovementRepository.save(
            StockMovement.recordSaleReversion({
              id: randomUUID(),
              tenantId: event.tenantId,
              productId: item.productId,
              quantity: item.quantity,
              referenceId: event.payload.saleId,
              referenceEventId: event.eventId,
              occurredAt: new Date(event.occurredAt)
            })
          );
        }

        await processedEventRepository.save(createProcessedEvent(event));

        return {
          saleId: event.payload.saleId,
          tenantId: event.tenantId,
          processedEventId: event.eventId,
          processingStatus: 'processed',
          affectedItemsCount: event.payload.items.length,
          stockMovementCount: event.payload.items.length
        };
      }
    );
  }
}

function createProcessedEvent(event: RevertSaleIssueInputDto['event']): ProcessedEvent {
  return ProcessedEvent.record({
    eventId: event.eventId,
    eventName: event.eventName,
    aggregateId: event.aggregateId,
    tenantId: event.tenantId,
    processedAt: new Date()
  });
}
