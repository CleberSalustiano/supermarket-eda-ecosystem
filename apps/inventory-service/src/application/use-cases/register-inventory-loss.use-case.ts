import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  createInventoryLossRegisteredEvent,
  DomainValidationError
} from '@supermarket/shared-domain';

import type {
  RegisterInventoryLossInputDto,
  RegisterInventoryLossOutputDto
} from '../dto/register-inventory-loss.dto';
import type { OutboxEventRelayPort } from '../ports/outbox-event-relay.port';
import { OUTBOX_EVENT_RELAY } from '../ports/outbox-event-relay.port';
import {
  INVENTORY_TRANSACTION_RUNNER,
  type InventoryTransactionRunnerPort
} from '../ports/inventory-transaction-runner.port';
import { InventoryItem } from '#/domain/entities/inventory-item.entity';
import { InventoryLoss } from '#/domain/entities/inventory-loss.entity';
import { StockMovement } from '#/domain/entities/stock-movement.entity';

@Injectable()
export class RegisterInventoryLossUseCase {
  constructor(
    @Inject(INVENTORY_TRANSACTION_RUNNER)
    private readonly transactionRunner: InventoryTransactionRunnerPort,
    @Inject(OUTBOX_EVENT_RELAY)
    private readonly outboxEventRelay: OutboxEventRelayPort
  ) {}

  async execute(
    input: RegisterInventoryLossInputDto
  ): Promise<RegisterInventoryLossOutputDto> {
    const occurredAt = ensureDateFromOptionalIsoString(input.occurredAt);
    const lossId = randomUUID();
    const stockMovementId = randomUUID();

    const result = await this.transactionRunner.execute(
      async ({
        inventoryLossRepository,
        inventoryItemRepository,
        outboxEventRepository,
        stockMovementRepository
      }) => {
        const inventoryItem =
          (await inventoryItemRepository.findByProductId(input.tenantId, input.productId)) ??
          InventoryItem.initialize({
            productId: input.productId,
            tenantId: input.tenantId,
            barcode: input.barcode,
            name: input.name,
            unitOfMeasure: input.unitOfMeasure
          });

        inventoryItem.registerLoss({
          barcode: input.barcode,
          name: input.name,
          unitOfMeasure: input.unitOfMeasure,
          quantity: input.quantity,
          updatedAt: occurredAt
        });

        const inventoryLoss = InventoryLoss.record({
          id: lossId,
          tenantId: input.tenantId,
          productId: input.productId,
          quantity: input.quantity,
          reasonCode: input.reasonCode,
          notes: input.notes,
          occurredAt
        });
        const itemState = inventoryItem.toPrimitives();
        const event = createInventoryLossRegisteredEvent({
          lossId,
          stockMovementId,
          tenantId: input.tenantId,
          productId: input.productId,
          barcode: itemState.barcode,
          name: itemState.name,
          unitOfMeasure: itemState.unitOfMeasure,
          quantity: input.quantity,
          reasonCode: input.reasonCode,
          notes: input.notes?.trim() || null,
          onHandQuantityAfterLoss: itemState.onHandQuantity,
          recordedAt: occurredAt.toISOString()
        });
        const stockMovement = StockMovement.recordLoss({
          id: stockMovementId,
          tenantId: input.tenantId,
          productId: input.productId,
          quantity: input.quantity,
          referenceId: lossId,
          referenceEventId: event.eventId,
          reasonCode: input.reasonCode,
          occurredAt
        });

        await inventoryItemRepository.save(inventoryItem);
        await inventoryLossRepository.save(inventoryLoss);
        await stockMovementRepository.save(stockMovement);

        await outboxEventRepository.save(event);

        return {
          lossId,
          tenantId: input.tenantId,
          productId: input.productId,
          stockMovementId,
          onHandQuantity: itemState.onHandQuantity,
          eventId: event.eventId
        };
      }
    );

    const eventPublicationStatus = await this.outboxEventRelay.dispatch(result.eventId);

    return {
      lossId: result.lossId,
      tenantId: result.tenantId,
      productId: result.productId,
      stockMovementId: result.stockMovementId,
      onHandQuantity: result.onHandQuantity,
      eventPublicationStatus
    };
  }
}

function ensureDateFromOptionalIsoString(value: string | undefined): Date {
  if (value === undefined) {
    return new Date();
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new DomainValidationError('Occurred at cannot be empty');
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new DomainValidationError('Occurred at is invalid');
  }

  return parsedDate;
}
