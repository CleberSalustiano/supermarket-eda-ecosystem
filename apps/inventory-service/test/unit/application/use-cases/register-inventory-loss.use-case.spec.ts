import { InventoryLossReason } from '@supermarket/shared-domain';

import { RegisterInventoryLossUseCase } from '#/application/use-cases/register-inventory-loss.use-case';
import {
  FakeOutboxEventRelay,
  InMemoryInventoryItemRepository,
  InMemoryInventoryLossRepository,
  InMemoryInventoryTransactionRunner,
  InMemoryOutboxEventRepository,
  InMemoryStockMovementRepository
} from '../../../support/in-memory-inventory-test-doubles';

describe('RegisterInventoryLossUseCase', () => {
  it('registers an inventory loss, records the outbox event, and dispatches it', async () => {
    const inventoryItemRepository = new InMemoryInventoryItemRepository();
    const inventoryLossRepository = new InMemoryInventoryLossRepository();
    const outboxEventRepository = new InMemoryOutboxEventRepository();
    const stockMovementRepository = new InMemoryStockMovementRepository();
    const transactionRunner = new InMemoryInventoryTransactionRunner({
      inventoryItemRepository,
      inventoryLossRepository,
      outboxEventRepository,
      stockMovementRepository
    });
    const outboxEventRelay = new FakeOutboxEventRelay('published');
    const useCase = new RegisterInventoryLossUseCase(transactionRunner, outboxEventRelay);

    const result = await useCase.execute({
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'UNIT',
      quantity: 2,
      reasonCode: InventoryLossReason.Damaged,
      notes: 'Bottle leaked'
    });

    expect(result).toMatchObject({
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      onHandQuantity: -2,
      eventPublicationStatus: 'published'
    });
    expect(inventoryItemRepository.all()[0]?.toPrimitives()).toMatchObject({
      onHandQuantity: -2
    });
    expect(inventoryLossRepository.all()).toHaveLength(1);
    expect(stockMovementRepository.all()).toHaveLength(1);
    expect(stockMovementRepository.all()[0]?.toPrimitives()).toMatchObject({
      movementType: 'LOSS',
      quantityDelta: -2
    });
    expect(outboxEventRepository.all()).toHaveLength(1);
    expect(outboxEventRelay.dispatchedEventIds).toHaveLength(1);
  });

  it('returns pending publication status when the outbox dispatch fails', async () => {
    const transactionRunner = new InMemoryInventoryTransactionRunner();
    const outboxEventRelay = new FakeOutboxEventRelay('pending');
    const useCase = new RegisterInventoryLossUseCase(transactionRunner, outboxEventRelay);

    const result = await useCase.execute({
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'UNIT',
      quantity: 1,
      reasonCode: InventoryLossReason.Other,
      notes: 'Manual adjustment'
    });

    expect(result.eventPublicationStatus).toBe('pending');
    expect(outboxEventRelay.dispatchedEventIds).toHaveLength(1);
  });
});
