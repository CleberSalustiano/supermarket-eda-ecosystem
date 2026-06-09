import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import type {
  CheckoutTransactionContext,
  CheckoutTransactionRunnerPort
} from '#/application/ports/checkout-transaction-runner.port';
import { TypeormOutboxEventRepository } from './repositories/typeorm-outbox-event.repository';
import { TypeormPosSessionRepository } from './repositories/typeorm-pos-session.repository';
import { TypeormProductCatalogItemRepository } from './repositories/typeorm-product-catalog-item.repository';
import { TypeormSaleRepository } from './repositories/typeorm-sale.repository';

@Injectable()
export class TypeormCheckoutTransactionRunner implements CheckoutTransactionRunnerPort {
  constructor(private readonly dataSource: DataSource) {}

  async execute<T>(work: (context: CheckoutTransactionContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) =>
      work({
        outboxEventRepository: new TypeormOutboxEventRepository(manager),
        productCatalogItemRepository: new TypeormProductCatalogItemRepository(manager),
        posSessionRepository: new TypeormPosSessionRepository(manager),
        saleRepository: new TypeormSaleRepository(manager)
      })
    );
  }
}
