import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import { DomainValidationError } from '@supermarket/shared-domain';

import type {
  RegisterPhysicalInventoryAdjustmentInputDto,
  RegisterPhysicalInventoryAdjustmentOutputDto
} from '../dto/register-physical-inventory-adjustment.dto';
import {
  INVENTORY_TRANSACTION_RUNNER,
  type InventoryTransactionRunnerPort
} from '../ports/inventory-transaction-runner.port';
import { InventoryItem } from '#/domain/entities/inventory-item.entity';
import { PhysicalInventoryAdjustment } from '#/domain/entities/physical-inventory-adjustment.entity';
import { StockMovement } from '#/domain/entities/stock-movement.entity';

@Injectable()
export class RegisterPhysicalInventoryAdjustmentUseCase {
  constructor(
    @Inject(INVENTORY_TRANSACTION_RUNNER)
    private readonly transactionRunner: InventoryTransactionRunnerPort
  ) {}

  async execute(
    input: RegisterPhysicalInventoryAdjustmentInputDto
  ): Promise<RegisterPhysicalInventoryAdjustmentOutputDto> {
    const occurredAt = ensureDateFromOptionalIsoString(input.occurredAt);
    const adjustmentId = randomUUID();
    const stockMovementId = randomUUID();

    return this.transactionRunner.execute(
      async ({
        inventoryItemRepository,
        physicalInventoryAdjustmentRepository,
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
        const previousState = inventoryItem.toPrimitives();
        const quantityDelta = inventoryItem.applyPhysicalCount({
          barcode: input.barcode,
          name: input.name,
          unitOfMeasure: input.unitOfMeasure,
          countedQuantity: input.countedQuantity,
          minimumThreshold: input.minimumThreshold,
          updatedAt: occurredAt
        });
        const itemState = inventoryItem.toPrimitives();
        const adjustment = PhysicalInventoryAdjustment.record({
          id: adjustmentId,
          tenantId: input.tenantId,
          productId: input.productId,
          collectorId: input.collectorId,
          previousOnHandQuantity: previousState.onHandQuantity,
          countedQuantity: itemState.onHandQuantity,
          minimumThreshold: itemState.minimumThreshold,
          reason: input.reason,
          occurredAt
        });
        const stockMovement = StockMovement.recordPhysicalAdjustment({
          id: stockMovementId,
          tenantId: input.tenantId,
          productId: input.productId,
          quantityDelta,
          referenceId: adjustmentId,
          referenceEventId: adjustmentId,
          occurredAt
        });

        await inventoryItemRepository.save(inventoryItem);
        await physicalInventoryAdjustmentRepository.save(adjustment);
        await stockMovementRepository.save(stockMovement);

        return {
          adjustmentId,
          tenantId: input.tenantId,
          productId: input.productId,
          quantityDelta,
          onHandQuantity: itemState.onHandQuantity,
          minimumThreshold: itemState.minimumThreshold,
          stockMovementId
        };
      }
    );
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
