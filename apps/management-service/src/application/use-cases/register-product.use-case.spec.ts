import { ConflictError } from '@supermarket/shared-domain';

import { RegisterProductUseCase } from './register-product.use-case';
import {
  FakeOutboxEventRelay,
  InMemoryManagementTransactionRunner
} from '../../../test/support/in-memory-management-test-doubles';

describe('RegisterProductUseCase', () => {
  it('registers a product and queues its integration event', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const outboxEventRelay = new FakeOutboxEventRelay('published');
    const useCase = new RegisterProductUseCase(transactionRunner, outboxEventRelay);

    const response = await useCase.execute({
      tenantId: '1badc48e-3ef4-47eb-8ac8-32c49d41c48f',
      name: 'Filtered Water',
      barcode: '7891000000100',
      unitOfMeasure: 'unit',
      price: 4.5
    });

    expect(response).toMatchObject({
      tenantId: '1badc48e-3ef4-47eb-8ac8-32c49d41c48f',
      barcode: '7891000000100',
      currentPrice: 4.5,
      eventPublicationStatus: 'published'
    });
    expect(transactionRunner.productRepository.all()).toHaveLength(1);
    expect(transactionRunner.outboxEventRepository.all()).toHaveLength(1);
    expect(outboxEventRelay.dispatchedEventIds).toHaveLength(1);
  });

  it('rejects duplicate barcodes inside the same tenant', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const outboxEventRelay = new FakeOutboxEventRelay();
    const useCase = new RegisterProductUseCase(transactionRunner, outboxEventRelay);

    await useCase.execute({
      tenantId: '8a562176-f8bb-4687-af8d-0ab055d417bc',
      name: 'Olive Oil',
      barcode: '7891000000101',
      unitOfMeasure: 'unit',
      price: 19.9
    });

    await expect(
      useCase.execute({
        tenantId: '8a562176-f8bb-4687-af8d-0ab055d417bc',
        name: 'Extra Virgin Olive Oil',
        barcode: '7891000000101',
        unitOfMeasure: 'unit',
        price: 21.5
      })
    ).rejects.toThrow(
      new ConflictError(
        'Barcode 7891000000101 is already registered for tenant 8a562176-f8bb-4687-af8d-0ab055d417bc'
      )
    );
  });
});
