import { ConflictError } from '@supermarket/shared-domain';

import { RegisterSupplierInvoiceUseCase } from '#/application/use-cases/register-supplier-invoice.use-case';
import {
  FakeOutboxEventRelay,
  InMemoryInventoryItemRepository,
  InMemoryInventoryTransactionRunner,
  InMemoryOutboxEventRepository,
  InMemoryStockMovementRepository,
  InMemorySupplierInvoiceRepository
} from '../../../support/in-memory-inventory-test-doubles';

describe('RegisterSupplierInvoiceUseCase', () => {
  it('registers a supplier invoice, updates stock with average cost, and dispatches ProductReceived', async () => {
    const inventoryItemRepository = new InMemoryInventoryItemRepository();
    const outboxEventRepository = new InMemoryOutboxEventRepository();
    const stockMovementRepository = new InMemoryStockMovementRepository();
    const supplierInvoiceRepository = new InMemorySupplierInvoiceRepository();
    const transactionRunner = new InMemoryInventoryTransactionRunner({
      inventoryItemRepository,
      outboxEventRepository,
      stockMovementRepository,
      supplierInvoiceRepository
    });
    const outboxEventRelay = new FakeOutboxEventRelay('published');
    const useCase = new RegisterSupplierInvoiceUseCase(transactionRunner, outboxEventRelay);

    const result = await useCase.execute({
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      supplierReference: 'nf-12345',
      receivedAt: '2026-06-12T09:00:00.000Z',
      items: [
        {
          productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
          barcode: '7891000000200',
          name: 'Orange Juice',
          unitOfMeasure: 'UNIT',
          quantity: 5,
          unitCost: 7.7
        }
      ]
    });

    expect(result).toMatchObject({
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      supplierReference: 'NF-12345',
      totalItemsQuantity: 5,
      totalCost: 38.5,
      eventPublicationStatus: 'published'
    });
    expect(result.items[0]).toMatchObject({
      onHandQuantity: 5,
      averageUnitCost: 7.7
    });
    expect(inventoryItemRepository.all()[0]?.toPrimitives()).toMatchObject({
      onHandQuantity: 5,
      averageUnitCost: 7.7
    });
    expect(stockMovementRepository.all()).toHaveLength(1);
    expect(stockMovementRepository.all()[0]?.toPrimitives()).toMatchObject({
      movementType: 'RECEIPT',
      quantityDelta: 5
    });
    expect(supplierInvoiceRepository.all()).toHaveLength(1);
    expect(outboxEventRepository.all()).toHaveLength(1);
    expect(outboxEventRepository.all()[0]?.eventName).toBe('ProductReceived');
    expect(outboxEventRelay.dispatchedEventIds).toHaveLength(1);
  });

  it('rejects a duplicate supplier reference for the same tenant', async () => {
    const supplierInvoiceRepository = new InMemorySupplierInvoiceRepository();
    const transactionRunner = new InMemoryInventoryTransactionRunner({
      supplierInvoiceRepository
    });
    const outboxEventRelay = new FakeOutboxEventRelay('published');
    const useCase = new RegisterSupplierInvoiceUseCase(transactionRunner, outboxEventRelay);

    await useCase.execute({
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      supplierReference: 'nf-12345',
      items: [
        {
          productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
          barcode: '7891000000200',
          name: 'Orange Juice',
          unitOfMeasure: 'UNIT',
          quantity: 5,
          unitCost: 7.7
        }
      ]
    });

    await expect(
      useCase.execute({
        tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
        supplierReference: 'NF-12345',
        items: [
          {
            productId: '8021d70d-bbbd-46c9-8d2b-9ebfe13c5424',
            barcode: '7891000000201',
            name: 'Whole Milk',
            unitOfMeasure: 'UNIT',
            quantity: 3,
            unitCost: 6.2
          }
        ]
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
