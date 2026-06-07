import { Injectable } from '@nestjs/common';

import type {
  EventEnvelope,
  ProductPriceUpdatedEventPayload
} from '@supermarket/shared-domain';

import type { SynchronizeProductCatalogItemOutputDto } from '#/application/dto/synchronize-product-catalog-item.dto';
import { SynchronizeProductCatalogItemUseCase } from '#/application/use-cases/synchronize-product-catalog-item.use-case';

@Injectable()
export class ProductPriceUpdatedConsumer {
  constructor(
    private readonly synchronizeProductCatalogItemUseCase: SynchronizeProductCatalogItemUseCase
  ) {}

  async handle(
    event: EventEnvelope<ProductPriceUpdatedEventPayload>
  ): Promise<SynchronizeProductCatalogItemOutputDto> {
    return this.synchronizeProductCatalogItemUseCase.execute({ event });
  }
}
