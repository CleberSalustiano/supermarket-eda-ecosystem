import { CashReconciliation } from '#/domain/entities/cash-reconciliation.entity';

describe('CashReconciliation', () => {
  it('classifies a balanced register closure correctly', () => {
    const reconciliation = CashReconciliation.reconcile({
      id: '7c8fd714-e490-489e-a152-2a1e8f59372d',
      tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
      sourceEventId: '7a05ec1d-5f47-4831-b6c0-89990277d4f9',
      sessionId: 'd2d71326-db87-42b9-9d6d-58de8c4f8424',
      registerId: 'register-01',
      operatorId: 'f6fb39a7-4561-42eb-b14b-5064bb66feb8',
      businessDate: '2026-06-09',
      openingFloatAmount: 100,
      declaredCashAmount: 142.5,
      expectedCashAmount: 142.5,
      closedAt: new Date('2026-06-09T22:30:00.000Z')
    });

    expect(reconciliation.toPrimitives()).toMatchObject({
      status: 'BALANCED',
      differenceAmount: 0
    });
  });

  it('classifies a shortage when declared cash is below the expected value', () => {
    const reconciliation = CashReconciliation.reconcile({
      id: '115ac417-bfbd-42f5-a6d6-8bd263c31f87',
      tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
      sourceEventId: '881e57e4-aa3c-4735-9368-f50bc1f31b35',
      sessionId: 'd2d71326-db87-42b9-9d6d-58de8c4f8424',
      registerId: 'register-01',
      operatorId: 'f6fb39a7-4561-42eb-b14b-5064bb66feb8',
      businessDate: '2026-06-09',
      openingFloatAmount: 100,
      declaredCashAmount: 140,
      expectedCashAmount: 142.5,
      closedAt: new Date('2026-06-09T22:30:00.000Z')
    });

    expect(reconciliation.toPrimitives()).toMatchObject({
      status: 'SHORTAGE',
      differenceAmount: -2.5
    });
  });
});
