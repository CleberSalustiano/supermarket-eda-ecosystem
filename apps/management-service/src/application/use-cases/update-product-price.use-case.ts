import { Inject, Injectable } from '@nestjs/common';

import {
  ResourceNotFoundError,
  createProductPriceUpdatedEvent,
  type ProductPriceUpdatedEventPayload
} from '@supermarket/shared-domain';

import type {
  UpdateProductPriceInputDto,
  UpdateProductPriceOutputDto
} from '../dto/update-product-price.dto';
import type { ManagementTransactionRunnerPort } from '../ports/management-transaction-runner.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '../ports/management-transaction-runner.port';
import type { OutboxEventRelayPort } from '../ports/outbox-event-relay.port';
import { OUTBOX_EVENT_RELAY } from '../ports/outbox-event-relay.port';

@Injectable()
export class UpdateProductPriceUseCase {
  constructor(
    @Inject(MANAGEMENT_TRANSACTION_RUNNER)
    private readonly transactionRunner: ManagementTransactionRunnerPort,
    @Inject(OUTBOX_EVENT_RELAY)
    private readonly outboxEventRelay: OutboxEventRelayPort
  ) {}

  async execute(input: UpdateProductPriceInputDto): Promise<UpdateProductPriceOutputDto> {
    const { integrationEvent, productState, previousPrice } = await this.transactionRunner.execute(
      async ({ outboxEventRepository, productRepository }) => {
        const product = await productRepository.findById(input.tenantId, input.productId);

        if (!product) {
          throw new ResourceNotFoundError(
            `Product ${input.productId} was not found for tenant ${input.tenantId}`
          );
        }

        const previousUnitPrice = product.updatePrice(input.price);
        const updatedProductState = product.toPrimitives();
        const event = createProductPriceUpdatedEvent({
          productId: updatedProductState.id,
          tenantId: updatedProductState.tenantId,
          barcode: updatedProductState.barcode,
          name: updatedProductState.name,
          unitOfMeasure: updatedProductState.unitOfMeasure,
          unitPrice: updatedProductState.currentPrice,
          previousUnitPrice,
          active: updatedProductState.active
        } satisfies ProductPriceUpdatedEventPayload);

        await productRepository.save(product);
        await outboxEventRepository.save(event);

        return {
          integrationEvent: event,
          previousPrice: previousUnitPrice,
          productState: updatedProductState
        };
      }
    );

    const eventPublicationStatus = await this.outboxEventRelay.dispatch(integrationEvent.eventId);

    return {
      productId: productState.id,
      tenantId: productState.tenantId,
      barcode: productState.barcode,
      name: productState.name,
      unitOfMeasure: productState.unitOfMeasure,
      currentPrice: productState.currentPrice,
      previousPrice,
      active: productState.active,
      eventPublicationStatus
    };
  }
}
