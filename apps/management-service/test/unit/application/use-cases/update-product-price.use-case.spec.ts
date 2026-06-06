import { ResourceNotFoundError } from '@supermarket/shared-domain';

import { RegisterProductUseCase } from '#/application/use-cases/register-product.use-case';
import { UpdateProductPriceUseCase } from '#/application/use-cases/update-product-price.use-case';
import {
  FakeOutboxEventRelay,
  InMemoryManagementTransactionRunner
} from '../../../support/in-memory-management-test-doubles';

describe('UpdateProductPriceUseCase', () => {
  it('updates the current product price and emits a new event', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const outboxEventRelay = new FakeOutboxEventRelay('published');
    const registerProduct = new RegisterProductUseCase(transactionRunner, outboxEventRelay);
    const updateProductPrice = new UpdateProductPriceUseCase(transactionRunner, outboxEventRelay);
    const product = await registerProduct.execute({
      tenantId: 'bc88f74d-703f-40aa-a7f9-99a9658d1e1d',
      name: 'Pasta',
      barcode: '7891000000102',
      unitOfMeasure: 'unit',
      price: 8.2
    });

    const response = await updateProductPrice.execute({
      tenantId: product.tenantId,
      productId: product.productId,
      price: 9.1
    });

    expect(response).toMatchObject({
      productId: product.productId,
      currentPrice: 9.1,
      previousPrice: 8.2,
      eventPublicationStatus: 'published'
    });
    expect(transactionRunner.outboxEventRepository.all()).toHaveLength(2);
  });

  it('fails when the product does not exist', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const outboxEventRelay = new FakeOutboxEventRelay();
    const useCase = new UpdateProductPriceUseCase(transactionRunner, outboxEventRelay);

    await expect(
      useCase.execute({
        tenantId: 'dfc6752f-aafe-4e14-bd55-c2e39d11b3aa',
        productId: '25599d20-cd92-455c-a8f5-6ef6b3ddabaf',
        price: 11.4
      })
    ).rejects.toThrow(
      new ResourceNotFoundError(
        'Product 25599d20-cd92-455c-a8f5-6ef6b3ddabaf was not found for tenant dfc6752f-aafe-4e14-bd55-c2e39d11b3aa'
      )
    );
  });
});
