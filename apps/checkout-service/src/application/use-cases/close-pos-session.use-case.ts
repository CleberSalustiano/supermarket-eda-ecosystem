import { Inject, Injectable } from '@nestjs/common';

import {
  ConflictError,
  ResourceNotFoundError,
  createRegisterClosedEvent,
  type RegisterClosedEventPayload
} from '@supermarket/shared-domain';

import type {
  ClosePosSessionInputDto,
  ClosePosSessionOutputDto
} from '../dto/close-pos-session.dto';
import { toClosePosSessionOutputDto } from '../dto/close-pos-session.dto';
import type { CheckoutTransactionRunnerPort } from '../ports/checkout-transaction-runner.port';
import { CHECKOUT_TRANSACTION_RUNNER } from '../ports/checkout-transaction-runner.port';
import type { OutboxEventRelayPort } from '../ports/outbox-event-relay.port';
import { OUTBOX_EVENT_RELAY } from '../ports/outbox-event-relay.port';
import { normalizeRequiredValue } from '../support/input-normalization';

@Injectable()
export class ClosePosSessionUseCase {
  constructor(
    @Inject(CHECKOUT_TRANSACTION_RUNNER)
    private readonly transactionRunner: CheckoutTransactionRunnerPort,
    @Inject(OUTBOX_EVENT_RELAY)
    private readonly outboxEventRelay: OutboxEventRelayPort
  ) {}

  async execute(input: ClosePosSessionInputDto): Promise<ClosePosSessionOutputDto> {
    const tenantId = normalizeRequiredValue(input.tenantId, 'Tenant id');
    const sessionId = normalizeRequiredValue(input.sessionId, 'POS session id');
    const result = await this.transactionRunner.execute(
      async ({ outboxEventRepository, posSessionRepository, saleRepository }) => {
        const session = await posSessionRepository.findById(tenantId, sessionId);

        if (!session) {
          throw new ResourceNotFoundError(
            `POS session ${sessionId} was not found for tenant ${tenantId}`
          );
        }

        if (await saleRepository.hasNonTerminalBySessionId(tenantId, sessionId)) {
          throw new ConflictError(
            `POS session ${sessionId} cannot be closed while it still has open or paid sales`
          );
        }

        session.close({
          declaredCashAmount: input.declaredCashAmount
        });

        const sessionState = session.toPrimitives();
        const integrationEvent = createRegisterClosedEvent({
          sessionId: sessionState.id,
          tenantId: sessionState.tenantId,
          registerId: sessionState.registerId,
          operatorId: sessionState.operatorId,
          openingFloatAmount: sessionState.openingFloatAmount,
          declaredCashAmount: sessionState.declaredCashAmount!,
          closedAt: sessionState.closedAt!
        } satisfies RegisterClosedEventPayload);

        await posSessionRepository.save(session);
        await outboxEventRepository.save(integrationEvent);

        return {
          eventId: integrationEvent.eventId,
          session
        };
      }
    );

    const eventPublicationStatus = await this.outboxEventRelay.dispatch(result.eventId);

    return toClosePosSessionOutputDto(result.session, eventPublicationStatus);
  }
}
