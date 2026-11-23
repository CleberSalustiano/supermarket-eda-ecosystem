import {
  AuthorizationDeniedError,
  ConflictError,
  DependencyUnavailableError,
  DomainValidationError,
  ResourceNotFoundError,
  SALE_CANCELED_EVENT_NAME,
  SalePaymentMethod,
  type SaleCanceledEventPayload,
  TooManyAttemptsError
} from '@supermarket/shared-domain';

import { MANAGER_APPROVAL_UNAVAILABLE_MESSAGE } from '#/application/ports/manager-approval-verifier.port';
import { CancelSaleUseCase } from '#/application/use-cases/cancel-sale.use-case';
import { PosSession } from '#/domain/entities/pos-session.entity';
import { Sale } from '#/domain/entities/sale.entity';
import { ManagerApproval } from '#/domain/value-objects/manager-approval';
import {
  FakeManagerApprovalVerifier,
  FakeOutboxEventRelay,
  InMemoryCheckoutTransactionRunner,
  InMemoryOutboxEventRepository,
  InMemoryPosSessionRepository,
  InMemorySaleRepository
} from '../../../support/in-memory-checkout-test-doubles';

const tenantId = 'e8197b86-cff7-406b-b879-c3810a8e731d';
const saleId = '3aeb9ee2-2772-47ea-b7be-0d3723e749d0';
const sessionId = '4bc1f77c-ae63-40c3-9210-ea3e6f868a50';
const approver = {
  employeeId: '9a4d2f7e-58a1-4c7b-8e1f-2b3c4d5e6f70',
  employeeCode: 'MANAGER-01',
  fullName: 'Bruno Lima'
};
const pin = '2468';

type SaleStage = 'OPEN' | 'PAID' | 'COMPLETED';

interface Fixture {
  useCase: CancelSaleUseCase;
  verifier: FakeManagerApprovalVerifier;
  outboxEventRelay: FakeOutboxEventRelay;
  outboxEventRepository: InMemoryOutboxEventRepository;
  posSessionRepository: InMemoryPosSessionRepository;
  saleRepository: InMemorySaleRepository;
}

async function createFixture(stage: SaleStage, sessionStatus: 'OPEN' | 'CLOSED' = 'OPEN') {
  const posSessionRepository = new InMemoryPosSessionRepository();
  const saleRepository = new InMemorySaleRepository();
  const outboxEventRepository = new InMemoryOutboxEventRepository();
  const transactionRunner = new InMemoryCheckoutTransactionRunner({
    outboxEventRepository,
    posSessionRepository,
    saleRepository
  });
  const outboxEventRelay = new FakeOutboxEventRelay('published');
  const verifier = new FakeManagerApprovalVerifier();
  const useCase = new CancelSaleUseCase(transactionRunner, outboxEventRelay, verifier);
  const sale = Sale.start({ id: saleId, tenantId, sessionId });

  sale.addItem({
    productId: '0df11434-3b4d-49de-844c-535b6d15922f',
    barcode: '7891000000200',
    name: 'Orange Juice',
    unitOfMeasure: 'unit',
    unitPrice: 9.9,
    quantity: 1
  });

  if (stage !== 'OPEN') {
    sale.registerPayment({ paymentMethod: SalePaymentMethod.Cash, paidAmount: 20 });
  }

  if (stage === 'COMPLETED') {
    sale.complete(new Date('2026-06-10T12:00:00.000Z'));
  }

  const session = PosSession.open({
    id: sessionId,
    tenantId,
    registerId: 'register-09',
    operatorId: '120c68ba-67ef-40fa-a4b3-76f970899720',
    openingFloatAmount: 90
  });

  if (sessionStatus === 'CLOSED') {
    session.close({ declaredCashAmount: 90 });
  }

  await posSessionRepository.save(session);
  await saleRepository.save(sale);

  return {
    useCase,
    verifier,
    outboxEventRelay,
    outboxEventRepository,
    posSessionRepository,
    saleRepository
  } satisfies Fixture;
}

async function storedSaleStatus(fixture: Fixture): Promise<string | undefined> {
  return (await fixture.saleRepository.findById(tenantId, saleId))?.toPrimitives().status;
}

function cancelInput(overrides: Record<string, unknown> = {}) {
  return {
    tenantId,
    saleId,
    reason: 'Customer requested reversal after price mismatch',
    managerApproval: { employeeCode: ' MANAGER-01 ', pin },
    ...overrides
  };
}

describe('CancelSaleUseCase', () => {
  it('cancels a completed sale after management approves and records the approver', async () => {
    const fixture = await createFixture('COMPLETED');

    fixture.verifier.respondWith(async () => ({ outcome: 'APPROVED', approver }));

    const result = await fixture.useCase.execute(cancelInput(), { correlationId: 'corr-42' });

    expect(result).toMatchObject({
      status: 'CANCELED',
      cancellationReason: 'Customer requested reversal after price mismatch',
      cancellationApprovedBy: approver,
      eventPublicationStatus: 'published'
    });
    expect(fixture.verifier.calls).toEqual([
      {
        request: {
          tenantId,
          approverCode: 'MANAGER-01',
          pin,
          registerId: 'register-09',
          saleId
        },
        context: { correlationId: 'corr-42' }
      }
    ]);

    const storedSale = await fixture.saleRepository.findById(tenantId, saleId);

    expect(storedSale?.toPrimitives()).toMatchObject({
      status: 'CANCELED',
      cancellationApproval: approver
    });

    const [event] = fixture.outboxEventRepository.all();
    const payload = event?.payload as SaleCanceledEventPayload | undefined;

    expect(event?.eventName).toBe(SALE_CANCELED_EVENT_NAME);
    expect(payload).toMatchObject({
      previousStatus: 'COMPLETED',
      approvedByEmployeeId: approver.employeeId,
      approvedByEmployeeCode: approver.employeeCode
    });
    expect(JSON.stringify(event)).not.toContain(pin);
    expect(JSON.stringify(result)).not.toContain(pin);
    expect(fixture.outboxEventRelay.dispatchedEventIds).toEqual([event?.eventId]);
  });

  it('reads under the row lock only in the write phase, after management answered', async () => {
    const fixture = await createFixture('COMPLETED');
    let lockedReadsDuringVerification: number | undefined;

    fixture.verifier.respondWith(async () => {
      lockedReadsDuringVerification = fixture.saleRepository.lockedReads.length;

      return { outcome: 'APPROVED', approver };
    });

    await fixture.useCase.execute(cancelInput());

    expect(lockedReadsDuringVerification).toBe(0);
    expect(fixture.saleRepository.lockedReads).toEqual([saleId]);
  });

  it('cancels a paid sale after approval', async () => {
    const fixture = await createFixture('PAID');

    fixture.verifier.respondWith(async () => ({ outcome: 'APPROVED', approver }));

    const result = await fixture.useCase.execute(cancelInput());

    expect(result.status).toBe('CANCELED');
    expect(fixture.outboxEventRepository.all()[0]?.payload).toMatchObject({
      previousStatus: 'PAID',
      approvedByEmployeeId: approver.employeeId
    });
  });

  it('cancels an open sale without calling management, ignoring any approval sent', async () => {
    const fixture = await createFixture('OPEN');

    const result = await fixture.useCase.execute(cancelInput());

    expect(result).toMatchObject({ status: 'CANCELED', cancellationApprovedBy: null });
    expect(fixture.verifier.calls).toHaveLength(0);
    expect(fixture.outboxEventRepository.all()[0]?.payload).toMatchObject({
      previousStatus: 'OPEN',
      approvedByEmployeeId: null,
      approvedByEmployeeCode: null
    });
  });

  it('cancels an open sale without an approval', async () => {
    const fixture = await createFixture('OPEN');

    await fixture.useCase.execute(cancelInput({ managerApproval: undefined }));

    expect(await storedSaleStatus(fixture)).toBe('CANCELED');
    expect(fixture.verifier.calls).toHaveLength(0);
  });

  it.each([undefined, null])(
    'rejects a paid sale with approval %s with 409 without calling management',
    async (managerApproval) => {
      const fixture = await createFixture('PAID');

      await expect(fixture.useCase.execute(cancelInput({ managerApproval }))).rejects.toThrow(
        new ConflictError(
          `Sale ${saleId} requires manager approval before cancellation after payment`
        )
      );
      expect(fixture.verifier.calls).toHaveLength(0);
      expect(await storedSaleStatus(fixture)).toBe('PAID');
    }
  );

  it.each([
    ['DENIED', AuthorizationDeniedError, 'Manager approval was rejected'],
    ['LOCKED', TooManyAttemptsError, 'Manager approval is temporarily locked']
  ] as const)(
    'maps %s to %p and leaves the sale unchanged',
    async (outcome, errorType, message) => {
      const fixture = await createFixture('COMPLETED');

      fixture.verifier.respondWith(async () => ({ outcome, approver: null }));

      const execution = fixture.useCase.execute(cancelInput());

      await expect(execution).rejects.toThrow(errorType);
      await expect(execution).rejects.toThrow(message);
      expect(fixture.verifier.calls).toHaveLength(1);
      expect(await storedSaleStatus(fixture)).toBe('COMPLETED');
      expect(fixture.outboxEventRepository.all()).toHaveLength(0);
      expect(fixture.outboxEventRelay.dispatchedEventIds).toHaveLength(0);
    }
  );

  it('propagates management unavailability as 503 once, without retry, and leaves the sale unchanged', async () => {
    const fixture = await createFixture('PAID');

    await expect(fixture.useCase.execute(cancelInput())).rejects.toThrow(
      new DependencyUnavailableError(MANAGER_APPROVAL_UNAVAILABLE_MESSAGE)
    );
    expect(fixture.verifier.calls).toHaveLength(1);
    expect(await storedSaleStatus(fixture)).toBe('PAID');
    expect(fixture.outboxEventRepository.all()).toHaveLength(0);
  });

  it('treats an APPROVED response without an approver as unavailable', async () => {
    const fixture = await createFixture('PAID');

    fixture.verifier.respondWith(async () => ({ outcome: 'APPROVED', approver: null }));

    await expect(fixture.useCase.execute(cancelInput())).rejects.toThrow(
      DependencyUnavailableError
    );
    expect(await storedSaleStatus(fixture)).toBe('PAID');
  });

  it('returns 409 when the sale is canceled concurrently while management verifies', async () => {
    const fixture = await createFixture('COMPLETED');

    fixture.verifier.respondWith(async () => {
      const concurrentSale = await fixture.saleRepository.findById(tenantId, saleId);

      concurrentSale!.cancel({
        reason: 'Canceled at another register',
        approval: ManagerApproval.create(approver)
      });
      await fixture.saleRepository.save(concurrentSale!);

      return { outcome: 'APPROVED', approver };
    });

    await expect(fixture.useCase.execute(cancelInput())).rejects.toThrow(ConflictError);
    expect(fixture.verifier.calls).toHaveLength(1);
    expect(fixture.outboxEventRepository.all()).toHaveLength(0);
    expect(
      (await fixture.saleRepository.findById(tenantId, saleId))?.toPrimitives().cancellationReason
    ).toBe('Canceled at another register');
  });

  it('returns 409 when the session closes while management verifies', async () => {
    const fixture = await createFixture('COMPLETED');

    fixture.verifier.respondWith(async () => {
      const session = await fixture.posSessionRepository.findById(tenantId, sessionId);

      session!.close({ declaredCashAmount: 100 });
      await fixture.posSessionRepository.save(session!);

      return { outcome: 'APPROVED', approver };
    });

    await expect(fixture.useCase.execute(cancelInput())).rejects.toThrow(ConflictError);
    expect(await storedSaleStatus(fixture)).toBe('COMPLETED');
  });

  describe('order of checks', () => {
    it('rejects a blank reason before loading the sale or calling management', async () => {
      const fixture = await createFixture('PAID');

      await expect(fixture.useCase.execute(cancelInput({ reason: '   ' }))).rejects.toThrow(
        DomainValidationError
      );
      expect(fixture.verifier.calls).toHaveLength(0);
    });

    it('returns 404 for a missing sale before calling management', async () => {
      const fixture = await createFixture('PAID');

      await expect(
        fixture.useCase.execute(cancelInput({ saleId: 'a1b2c3d4-0000-4000-8000-000000000000' }))
      ).rejects.toThrow(ResourceNotFoundError);
      expect(fixture.verifier.calls).toHaveLength(0);
    });

    it('returns 409 for a closed session before checking the approval', async () => {
      const fixture = await createFixture('PAID', 'CLOSED');

      await expect(
        fixture.useCase.execute(cancelInput({ managerApproval: undefined }))
      ).rejects.toThrow(`POS session ${sessionId} is not open`);
      expect(fixture.verifier.calls).toHaveLength(0);
    });

    it('returns 409 for an already canceled sale before calling management', async () => {
      const fixture = await createFixture('OPEN');

      await fixture.useCase.execute(cancelInput({ managerApproval: undefined }));

      await expect(fixture.useCase.execute(cancelInput())).rejects.toThrow(
        `Sale ${saleId} is already canceled`
      );
      expect(fixture.verifier.calls).toHaveLength(0);
    });
  });
});
