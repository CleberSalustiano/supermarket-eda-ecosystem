import { DomainValidationError } from '@supermarket/shared-domain';

import { ManagerApprovalAttempt } from '#/domain/entities/manager-approval-attempt.entity';

const base = {
  id: '0a0d2c1e-7f4b-4d0e-9a51-0f3f8c2b9e11',
  tenantId: '72ac8252-18c8-4d9c-84ff-866f297a1d77',
  approverCode: ' mg-01 ',
  employeeId: null,
  registerId: 'register-01',
  saleId: 'b1f0b5a4-1c2d-4e3f-8a9b-0c1d2e3f4a5b',
  attemptedAt: new Date('2026-11-23T10:00:00.000Z')
};

describe('ManagerApprovalAttempt', () => {
  it('records an upper-cased code and never carries a PIN', () => {
    const attempt = ManagerApprovalAttempt.record({
      ...base,
      outcome: 'DENIED',
      reason: 'UNKNOWN_CODE'
    });

    expect(attempt.toPrimitives()).toEqual({
      ...base,
      approverCode: 'MG-01',
      outcome: 'DENIED',
      reason: 'UNKNOWN_CODE',
      attemptedAt: '2026-11-23T10:00:00.000Z'
    });
    expect(Object.keys(attempt.toPrimitives())).not.toContain('pin');
  });

  it('requires a reason that matches the outcome', () => {
    expect(() =>
      ManagerApprovalAttempt.record({ ...base, outcome: 'APPROVED', reason: 'WRONG_PIN' })
    ).toThrow(DomainValidationError);
    expect(() =>
      ManagerApprovalAttempt.record({ ...base, outcome: 'DENIED', reason: 'CODE_LOCKED' })
    ).toThrow(DomainValidationError);
    expect(() => ManagerApprovalAttempt.record({ ...base, outcome: 'DENIED', reason: null })).toThrow(
      DomainValidationError
    );
    expect(() =>
      ManagerApprovalAttempt.record({ ...base, outcome: 'LOCKED', reason: 'WRONG_PIN' })
    ).toThrow(DomainValidationError);
    expect(() =>
      ManagerApprovalAttempt.record({ ...base, outcome: 'LOCKED', reason: 'REGISTER_LOCKED' })
    ).not.toThrow();
    expect(() =>
      ManagerApprovalAttempt.record({ ...base, outcome: 'APPROVED', reason: null })
    ).not.toThrow();
  });
});
