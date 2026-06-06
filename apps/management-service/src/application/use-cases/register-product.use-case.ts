import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  ConflictError,
  createNewProductRegisteredEvent,
  type NewProductRegisteredEventPayload
} from '@supermarket/shared-domain';

import type {
  RegisterProductInputDto,
  RegisterProductOutputDto
} from '../dto/register-product.dto';
import type { ManagementTransactionRunnerPort } from '../ports/management-transaction-runner.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '../ports/management-transaction-runner.port';
import type { OutboxEventRelayPort } from '../ports/outbox-event-relay.port';
import { OUTBOX_EVENT_RELAY } from '../ports/outbox-event-relay.port';
import { Product } from '../../domain/entities/product.entity';

@Injectable()
export class RegisterProductUseCase {
  constructor(
    @Inject(MANAGEMENT_TRANSACTION_RUNNER)
    private readonly transactionRunner: ManagementTransactionRunnerPort,
    @Inject(OUTBOX_EVENT_RELAY)
    private readonly outboxEventRelay: OutboxEventRelayPort
  ) {}

  async execute(input: RegisterProductInputDto): Promise<RegisterProductOutputDto> {
    const product = Product.register({
      id: randomUUID(),
      tenantId: input.tenantId,
      name: input.name,
      barcode: input.barcode,
      unitOfMeasure: input.unitOfMeasure,
      currentPrice: input.price
    });
    const productState = product.toPrimitives();
    const integrationEvent = createNewProductRegisteredEvent({
      productId: productState.id,
      tenantId: productState.tenantId,
      barcode: productState.barcode,
      name: productState.name,
      unitOfMeasure: productState.unitOfMeasure,
      unitPrice: productState.currentPrice,
      active: productState.active
    } satisfies NewProductRegisteredEventPayload);

    await this.transactionRunner.execute(async ({ outboxEventRepository, productRepository }) => {
      const existingProduct = await productRepository.findByBarcode(
        productState.tenantId,
        productState.barcode
      );

      if (existingProduct !== null) {
        throw new ConflictError(
          `Barcode ${productState.barcode} is already registered for tenant ${productState.tenantId}`
        );
      }

      await productRepository.save(product);
      await outboxEventRepository.save(integrationEvent);
    });

    const eventPublicationStatus = await this.outboxEventRelay.dispatch(integrationEvent.eventId);

    return {
      productId: productState.id,
      tenantId: productState.tenantId,
      name: productState.name,
      barcode: productState.barcode,
      unitOfMeasure: productState.unitOfMeasure,
      currentPrice: productState.currentPrice,
      active: productState.active,
      eventPublicationStatus
    };
  }
}
