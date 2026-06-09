import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  INVENTORY_TRANSACTION_RUNNER,
  type InventoryTransactionRunnerPort
} from '../ports/inventory-transaction-runner.port';
import type { ProcessSaleIssueInputDto, ProcessSaleIssueOutputDto } from '../dto/process-sale-issue.dto';
import { InventoryItem } from '#/domain/entities/inventory-item.entity';
import { ProcessedEvent } from '#/domain/entities/processed-event.entity';
import { StockMovement } from '#/domain/entities/stock-movement.entity';

@Injectable()
export class ProcessSaleIssueUseCase {
  constructor(
    @Inject(INVENTORY_TRANSACTION_RUNNER)
    private readonly transactionRunner: InventoryTransactionRunnerPort
  ) {}

  async execute(input: ProcessSaleIssueInputDto): Promise<ProcessSaleIssueOutputDto> {
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

        for (const item of event.payload.items) {
          const inventoryItem =
            (await inventoryItemRepository.findByProductId(event.tenantId, item.productId)) ??
            InventoryItem.initialize({
              productId: item.productId,
              tenantId: event.tenantId,
              barcode: item.barcode,
              name: item.name,
              unitOfMeasure: item.unitOfMeasure
            });

          inventoryItem.issueSale({
            barcode: item.barcode,
            name: item.name,
            unitOfMeasure: item.unitOfMeasure,
            quantity: item.quantity,
            updatedAt: new Date(event.occurredAt)
          });

          await inventoryItemRepository.save(inventoryItem);
          await stockMovementRepository.save(
            StockMovement.recordSaleIssue({
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

        await processedEventRepository.save(
          ProcessedEvent.record({
            eventId: event.eventId,
            eventName: event.eventName,
            aggregateId: event.aggregateId,
            tenantId: event.tenantId,
            processedAt: new Date()
          })
        );

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
