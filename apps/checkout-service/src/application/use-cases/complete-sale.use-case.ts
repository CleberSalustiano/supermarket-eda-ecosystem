import { Inject, Injectable } from '@nestjs/common';

import {
  createSaleCompletedEvent,
  type SaleCompletedEventPayload
} from '@supermarket/shared-domain';

import type { CompleteSaleInputDto, CompleteSaleOutputDto } from '../dto/sale.dto';
import { toCompleteSaleOutputDto } from '../dto/sale.dto';
import type { CheckoutTransactionRunnerPort } from '../ports/checkout-transaction-runner.port';
import { CHECKOUT_TRANSACTION_RUNNER } from '../ports/checkout-transaction-runner.port';
import type { OutboxEventRelayPort } from '../ports/outbox-event-relay.port';
import { OUTBOX_EVENT_RELAY } from '../ports/outbox-event-relay.port';
import { normalizeRequiredValue } from '../support/input-normalization';
import { ResourceNotFoundError } from '@supermarket/shared-domain';

@Injectable()
export class CompleteSaleUseCase {
  constructor(
    @Inject(CHECKOUT_TRANSACTION_RUNNER)
    private readonly transactionRunner: CheckoutTransactionRunnerPort,
    @Inject(OUTBOX_EVENT_RELAY)
    private readonly outboxEventRelay: OutboxEventRelayPort
  ) {}

  async execute(input: CompleteSaleInputDto): Promise<CompleteSaleOutputDto> {
    const tenantId = normalizeRequiredValue(input.tenantId, 'Tenant id');
    const saleId = normalizeRequiredValue(input.saleId, 'Sale id');
    const integrationEvent = await this.transactionRunner.execute(
      async ({ outboxEventRepository, posSessionRepository, saleRepository }) => {
        const sale = await saleRepository.findById(tenantId, saleId);

        if (!sale) {
          throw new ResourceNotFoundError(`Sale ${saleId} was not found for tenant ${tenantId}`);
        }

        const saleStateBeforeCompletion = sale.toPrimitives();
        const session = await posSessionRepository.findById(
          tenantId,
          saleStateBeforeCompletion.sessionId
        );

        if (!session) {
          throw new ResourceNotFoundError(
            `POS session ${saleStateBeforeCompletion.sessionId} was not found for tenant ${tenantId}`
          );
        }

        session.assertOpen();
        sale.complete();

        const saleState = sale.toPrimitives();
        const sessionState = session.toPrimitives();
        const integrationEvent = createSaleCompletedEvent({
          saleId: saleState.id,
          tenantId: saleState.tenantId,
          sessionId: saleState.sessionId,
          registerId: sessionState.registerId,
          operatorId: sessionState.operatorId,
          paymentMethod: saleState.paymentMethod!,
          paidAmount: saleState.paidAmount!,
          changeAmount: saleState.changeAmount!,
          totalItemsQuantity: saleState.totalItemsQuantity,
          subtotal: saleState.subtotal,
          total: saleState.total,
          completedAt: saleState.completedAt!,
          items: saleState.items.map((item) => ({
            productId: item.productId,
            barcode: item.barcode,
            name: item.name,
            unitOfMeasure: item.unitOfMeasure,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            lineTotal: item.lineTotal
          }))
        } satisfies SaleCompletedEventPayload);

        await saleRepository.save(sale);
        await outboxEventRepository.save(integrationEvent);

        return {
          eventId: integrationEvent.eventId,
          sale
        };
      }
    );

    const eventPublicationStatus = await this.outboxEventRelay.dispatch(integrationEvent.eventId);

    return toCompleteSaleOutputDto(integrationEvent.sale, eventPublicationStatus);
  }
}
