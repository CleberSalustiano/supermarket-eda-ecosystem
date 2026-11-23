import { Inject, Injectable } from '@nestjs/common';

import {
  AuthorizationDeniedError,
  createSaleCanceledEvent,
  DependencyUnavailableError,
  type ManagerApprovalVerificationResponse,
  type SaleCanceledEventPayload,
  ResourceNotFoundError,
  TooManyAttemptsError
} from '@supermarket/shared-domain';

import type {
  CancelSaleContextDto,
  CancelSaleInputDto,
  CancelSaleManagerApprovalInputDto,
  CancelSaleOutputDto
} from '../dto/sale.dto';
import { toCancelSaleOutputDto } from '../dto/sale.dto';
import type {
  CheckoutTransactionContext,
  CheckoutTransactionRunnerPort
} from '../ports/checkout-transaction-runner.port';
import { CHECKOUT_TRANSACTION_RUNNER } from '../ports/checkout-transaction-runner.port';
import type { ManagerApprovalVerifierPort } from '../ports/manager-approval-verifier.port';
import {
  MANAGER_APPROVAL_UNAVAILABLE_MESSAGE,
  MANAGER_APPROVAL_VERIFIER
} from '../ports/manager-approval-verifier.port';
import type { OutboxEventRelayPort } from '../ports/outbox-event-relay.port';
import { OUTBOX_EVENT_RELAY } from '../ports/outbox-event-relay.port';
import { normalizeRequiredValue } from '../support/input-normalization';
import type { PosSession } from '#/domain/entities/pos-session.entity';
import type { Sale, SaleStatus } from '#/domain/entities/sale.entity';
import { ManagerApproval } from '#/domain/value-objects/manager-approval';

type CancelableSaleStatus = Extract<SaleStatus, 'OPEN' | 'PAID' | 'COMPLETED'>;

interface CancellationPreconditions {
  registerId: string;
  requiresManagerApproval: boolean;
}

@Injectable()
export class CancelSaleUseCase {
  constructor(
    @Inject(CHECKOUT_TRANSACTION_RUNNER)
    private readonly transactionRunner: CheckoutTransactionRunnerPort,
    @Inject(OUTBOX_EVENT_RELAY)
    private readonly outboxEventRelay: OutboxEventRelayPort,
    @Inject(MANAGER_APPROVAL_VERIFIER)
    private readonly managerApprovalVerifier: ManagerApprovalVerifierPort
  ) {}

  async execute(
    input: CancelSaleInputDto,
    context: CancelSaleContextDto = {}
  ): Promise<CancelSaleOutputDto> {
    const tenantId = normalizeRequiredValue(input.tenantId, 'Tenant id');
    const saleId = normalizeRequiredValue(input.saleId, 'Sale id');
    const reason = normalizeRequiredValue(input.reason, 'Cancellation reason');
    const managerApproval = input.managerApproval ?? undefined;

    // Read phase: a short transaction that commits before management is called,
    // so no database transaction is held open across the HTTP round trip.
    const preconditions = await this.transactionRunner.execute(async (transactionContext) => {
      const { sale, session } = await loadSaleAndSession(transactionContext, tenantId, saleId, {
        lockSale: false
      });

      session.assertOpen();
      sale.assertCancelable({ approvalProvided: managerApproval !== undefined });

      return {
        registerId: session.toPrimitives().registerId,
        requiresManagerApproval: sale.requiresManagerApprovalToCancel()
      } satisfies CancellationPreconditions;
    });

    const approval =
      preconditions.requiresManagerApproval && managerApproval
        ? await this.verifyManagerApproval(
            { tenantId, saleId, registerId: preconditions.registerId },
            managerApproval,
            context
          )
        : undefined;

    // Write phase: reload the sale under a row lock and re-check, because the sale
    // or the session may have changed while management was verifying the approval.
    // The lock serializes concurrent cancellations, so exactly one commits and
    // exactly one SaleCanceled reaches the outbox; the others get 409.
    const result = await this.transactionRunner.execute(async (transactionContext) => {
      const { outboxEventRepository, saleRepository } = transactionContext;
      const { sale, session } = await loadSaleAndSession(transactionContext, tenantId, saleId, {
        lockSale: true
      });
      const saleStateBeforeCancellation = sale.toPrimitives();

      session.assertOpen();
      sale.cancel({ reason, approval });

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
        })),
        approvedByEmployeeId: saleState.cancellationApproval?.employeeId ?? null,
        approvedByEmployeeCode: saleState.cancellationApproval?.employeeCode ?? null
      } satisfies SaleCanceledEventPayload);

      await saleRepository.save(sale);
      await outboxEventRepository.save(integrationEvent);

      return {
        eventId: integrationEvent.eventId,
        sale
      };
    });

    const eventPublicationStatus = await this.outboxEventRelay.dispatch(result.eventId);

    return toCancelSaleOutputDto(result.sale, eventPublicationStatus);
  }

  /**
   * Calls management exactly once (never retried: a retry could count one
   * failed attempt twice against the lockouts). The PIN only travels in this
   * call and is never stored, logged or echoed in an error.
   */
  private async verifyManagerApproval(
    target: { tenantId: string; saleId: string; registerId: string },
    managerApproval: CancelSaleManagerApprovalInputDto,
    context: CancelSaleContextDto
  ): Promise<ManagerApproval> {
    const verification = await this.managerApprovalVerifier.verify(
      {
        tenantId: target.tenantId,
        approverCode: managerApproval.employeeCode.trim(),
        pin: managerApproval.pin,
        registerId: target.registerId,
        saleId: target.saleId
      },
      { correlationId: context.correlationId }
    );

    return toManagerApproval(verification);
  }
}

async function loadSaleAndSession(
  { posSessionRepository, saleRepository }: CheckoutTransactionContext,
  tenantId: string,
  saleId: string,
  options: { lockSale: boolean }
): Promise<{ sale: Sale; session: PosSession }> {
  const sale = options.lockSale
    ? await saleRepository.findByIdForUpdate(tenantId, saleId)
    : await saleRepository.findById(tenantId, saleId);

  if (!sale) {
    throw new ResourceNotFoundError(`Sale ${saleId} was not found for tenant ${tenantId}`);
  }

  const { sessionId } = sale.toPrimitives();
  const session = await posSessionRepository.findById(tenantId, sessionId);

  if (!session) {
    throw new ResourceNotFoundError(
      `POS session ${sessionId} was not found for tenant ${tenantId}`
    );
  }

  return { sale, session };
}

function toManagerApproval(verification: ManagerApprovalVerificationResponse): ManagerApproval {
  switch (verification.outcome) {
    case 'APPROVED':
      if (!verification.approver) {
        throw new DependencyUnavailableError(MANAGER_APPROVAL_UNAVAILABLE_MESSAGE);
      }

      return ManagerApproval.create(verification.approver);
    case 'DENIED':
      throw new AuthorizationDeniedError('Manager approval was rejected');
    case 'LOCKED':
      throw new TooManyAttemptsError('Manager approval is temporarily locked');
    default:
      throw new DependencyUnavailableError(MANAGER_APPROVAL_UNAVAILABLE_MESSAGE);
  }
}

function toCancelableStatus(status: SaleStatus): CancelableSaleStatus {
  if (status === 'OPEN' || status === 'PAID' || status === 'COMPLETED') {
    return status;
  }

  throw new Error(`Sale status ${status} cannot be used for cancellation events`);
}
