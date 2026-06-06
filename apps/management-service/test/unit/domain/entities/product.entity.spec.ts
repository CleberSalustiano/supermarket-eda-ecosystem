import { DomainValidationError } from '@supermarket/shared-domain';

import { Product } from '../../../../src/domain/entities/product.entity';

describe('Product', () => {
  it('registers a valid product with normalized price and unit of measure', () => {
    const product = Product.register({
      id: '9af6c9f8-9b8f-42e9-a5d5-b9940ce7b3d9',
      tenantId: '29d54e6f-9a57-4a50-b0e8-44a1e00c18d2',
      name: 'Ground Coffee',
      barcode: '7891000000012',
      unitOfMeasure: 'un',
      currentPrice: 14.999
    });

    expect(product.toPrimitives()).toMatchObject({
      name: 'Ground Coffee',
      barcode: '7891000000012',
      unitOfMeasure: 'UN',
      currentPrice: 15
    });
  });

  it('updates the price and returns the previous value', () => {
    const product = Product.register({
      id: 'f24ef755-a062-44d7-84bf-6d2eeff0e247',
      tenantId: 'f614da0a-fc96-4985-ac44-aa41ad02f05d',
      name: 'Chocolate Milk',
      barcode: '7891000000013',
      unitOfMeasure: 'unit',
      currentPrice: 6.5
    });

    const previousPrice = product.updatePrice(7.9);

    expect(previousPrice).toBe(6.5);
    expect(product.toPrimitives().currentPrice).toBe(7.9);
  });

  it('rejects a repeated price update', () => {
    const product = Product.register({
      id: 'f2a64df5-9a7f-4847-91fe-fca6d16b6f90',
      tenantId: '5f1621a2-70dd-47c7-b848-b6afb7e44ff8',
      name: 'Long Grain Rice',
      barcode: '7891000000014',
      unitOfMeasure: 'kg',
      currentPrice: 25
    });

    expect(() => product.updatePrice(25)).toThrow(
      new DomainValidationError('New price must differ from the current price')
    );
  });
});
