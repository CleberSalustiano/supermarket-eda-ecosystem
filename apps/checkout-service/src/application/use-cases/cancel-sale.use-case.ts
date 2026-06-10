import { Inject, Injectable } from '@nestjs/common';

import {
  createSaleCanceledEvent,
  type SaleCanceledEventPayload,
  ResourceNotFoundError
} from '@supermarket/shared-domain';

import type { CancelSaleInputDto, CancelSaleOutputDto } from '../dto/sale.dto';
import { toCancelSaleOutputDto } from '../dto/sale.dto';
import type { CheckoutTransactionRunnerPort } from '../ports/checkout-transaction-runner.port';
import { CHECKOUT_TRANSACTION_RUNNER } from '../ports/checkout-transaction-runner.port';
import type { OutboxEventRelayPort } from '../ports/outbox-event-relay.port';
import { OUTBOX_EVENT_RELAY } from '../ports/outbox-event-relay.port';
import { normalizeRequiredValue } from '../support/input-normalization';
import type { SaleStatus } from '#/domain/entities/sale.entity';

type CancelableSaleStatus = Extract<SaleStatus, 'OPEN' | 'PAID' | 'COMPLETED'>;

@Injectable()
export class CancelSaleUseCase {
  constructor(
    @Inject(CHECKOUT_TRANSACTION_RUNNER)
    private readonly transactionRunner: CheckoutTransactionRunnerPort,
    @Inject(OUTBOX_EVENT_RELAY)
    private readonly outboxEventRelay: OutboxEventRelayPort
  ) {}

  async execute(input: CancelSaleInputDto): Promise<CancelSaleOutputDto> {
    const tenantId = normalizeRequiredValue(input.tenantId, 'Tenant id');
    const saleId = normalizeRequiredValue(input.saleId, 'Sale id');
    const result = await this.transactionRunner.execute(
      async ({ outboxEventRepository, posSessionRepository, saleRepository }) => {
        const sale = await saleRepository.findById(tenantId, saleId);

        if (!sale) {
          throw new ResourceNotFoundError(`Sale ${saleId} was not found for tenant ${tenantId}`);
        }

        const saleStateBeforeCancellation = sale.toPrimitives();
        const session = await posSessionRepository.findById(
          tenantId,
          saleStateBeforeCancellation.sessionId
        );

        if (!session) {
          throw new ResourceNotFoundError(
            `POS session ${saleStateBeforeCancellation.sessionId} was not found for tenant ${tenantId}`
          );
        }

        session.assertOpen();
        sale.cancel({
          reason: input.reason,
          managerApprovalCode: input.managerApprovalCode
        });

        const saleState = sale.toPrimitives();
        const sessionState = session.toPrimitives();
        const integrationEvent = createSaleCanceledEvent({
          saleId: saleState.id,
          tenantId: saleState.tenantId,
          sessionId: saleState.sessionId,
          registerId: sessionState.registerId,
          operatorId: sessionState.operatorId,
          previousStatus: toCancelableStatus(saleStateBeforeCancellation.status),
          paymentMethod: saleState.paymentMethod,
          paidAmount: saleState.paidAmount,
          changeAmount: saleState.changeAmount,
          totalItemsQuantity: saleState.totalItemsQuantity,
          subtotal: saleState.subtotal,
          total: saleState.total,
          cancellationReason: saleState.cancellationReason!,
          canceledAt: saleState.canceledAt!,
          items: saleState.items.map((item) => ({
            productId: item.productId,
            barcode: item.barcode,
            name: item.name,
            unitOfMeasure: item.unitOfMeasure,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            lineTotal: item.lineTotal
          }))
        } satisfies SaleCanceledEventPayload);

        await saleRepository.save(sale);
        await outboxEventRepository.save(integrationEvent);

        return {
          eventId: integrationEvent.eventId,
          sale
        };
      }
    );

    const eventPublicationStatus = await this.outboxEventRelay.dispatch(result.eventId);

    return toCancelSaleOutputDto(result.sale, eventPublicationStatus);
  }
}

function toCancelableStatus(status: SaleStatus): CancelableSaleStatus {
  if (status === 'OPEN' || status === 'PAID' || status === 'COMPLETED') {
    return status;
  }

  throw new Error(`Sale status ${status} cannot be used for cancellation events`);
}
