import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import { createLowStockAlertEvent } from '@supermarket/shared-domain';

import type {
  EmitLowStockAlertsInputDto,
  EmitLowStockAlertsOutputDto
} from '../dto/emit-low-stock-alerts.dto';
import type { OutboxEventRelayPort } from '../ports/outbox-event-relay.port';
import { OUTBOX_EVENT_RELAY } from '../ports/outbox-event-relay.port';
import {
  INVENTORY_TRANSACTION_RUNNER,
  type InventoryTransactionRunnerPort
} from '../ports/inventory-transaction-runner.port';
import {
  LOW_STOCK_ALERT_OPTIONS,
  type LowStockAlertOptions
} from '../ports/low-stock-alert.options';

@Injectable()
export class EmitLowStockAlertsUseCase {
  constructor(
    @Inject(INVENTORY_TRANSACTION_RUNNER)
    private readonly transactionRunner: InventoryTransactionRunnerPort,
    @Inject(LOW_STOCK_ALERT_OPTIONS)
    private readonly lowStockAlertOptions: LowStockAlertOptions,
    @Inject(OUTBOX_EVENT_RELAY)
    private readonly outboxEventRelay: OutboxEventRelayPort
  ) {}

  async execute(input: EmitLowStockAlertsInputDto = {}): Promise<EmitLowStockAlertsOutputDto> {
    const emittedAt = input.emittedAt ?? new Date();
    const cooldownCutoff = new Date(
      emittedAt.getTime() - this.lowStockAlertOptions.cooldownMinutes * 60 * 1000
    );

    const result = await this.transactionRunner.execute(
      async ({ inventoryItemRepository, outboxEventRepository }) => {
        const candidates = await inventoryItemRepository.findLowStockCandidates(
          cooldownCutoff,
          this.lowStockAlertOptions.maxItemsPerBatch * 20
        );
        const candidatesByTenant = new Map<string, typeof candidates>();

        for (const item of candidates) {
          const itemState = item.toPrimitives();
          const tenantItems = candidatesByTenant.get(itemState.tenantId) ?? [];

          tenantItems.push(item);
          candidatesByTenant.set(itemState.tenantId, tenantItems);
        }

        const batches: Array<{
          eventId: string;
          alertId: string;
          tenantId: string;
          itemsCount: number;
        }> = [];

        for (const [tenantId, tenantItems] of candidatesByTenant.entries()) {
          for (
            let index = 0;
            index < tenantItems.length;
            index += this.lowStockAlertOptions.maxItemsPerBatch
          ) {
            const chunk = tenantItems.slice(
              index,
              index + this.lowStockAlertOptions.maxItemsPerBatch
            );
            const alertId = randomUUID();
            const event = createLowStockAlertEvent({
              alertId,
              tenantId,
              emittedAt: emittedAt.toISOString(),
              items: chunk.map((item) => {
                const itemState = item.toPrimitives();

                return {
                  productId: itemState.productId,
                  barcode: itemState.barcode,
                  name: itemState.name,
                  unitOfMeasure: itemState.unitOfMeasure,
                  onHandQuantity: itemState.onHandQuantity,
                  minimumThreshold: itemState.minimumThreshold,
                  averageUnitCost: itemState.averageUnitCost
                };
              })
            });

            for (const item of chunk) {
              item.markLowStockAlertEmitted(emittedAt);
              await inventoryItemRepository.save(item);
            }

            await outboxEventRepository.save(event);
            batches.push({
              eventId: event.eventId,
              alertId,
              tenantId,
              itemsCount: chunk.length
            });
          }
        }

        return {
          scannedCandidates: candidates.length,
          batches
        };
      }
    );

    const emittedBatches = [];

    for (const batch of result.batches) {
      const eventPublicationStatus = await this.outboxEventRelay.dispatch(batch.eventId);

      emittedBatches.push({
        eventId: batch.eventId,
        alertId: batch.alertId,
        tenantId: batch.tenantId,
        itemsCount: batch.itemsCount,
        eventPublicationStatus
      });
    }

    return {
      emittedAt: emittedAt.toISOString(),
      scannedCandidates: result.scannedCandidates,
      emittedBatches
    };
  }
}
