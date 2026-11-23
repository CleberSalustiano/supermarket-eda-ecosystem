import {
  MANAGER_APPROVAL_VERIFICATION_PATH,
  isManagerApprovalVerificationResponse
} from '#/contracts/manager-approval-verification.contract';

const approver = {
  employeeId: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  employeeCode: 'MGR-01',
  fullName: 'Maria Gerente'
};

describe('manager approval verification contract', () => {
  it('exposes the internal verification path', () => {
    expect(MANAGER_APPROVAL_VERIFICATION_PATH).toBe('/internal/manager-approvals/verifications');
  });

  it.each([
    ['an approved response with its approver', { outcome: 'APPROVED', approver }],
    ['a denied response without approver', { outcome: 'DENIED', approver: null }],
    ['a locked response without approver', { outcome: 'LOCKED', approver: null }]
  ])('accepts %s', (_label, value) => {
    expect(isManagerApprovalVerificationResponse(value)).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'APPROVED'],
    ['an array', [{ outcome: 'DENIED', approver: null }]],
    ['an unknown outcome', { outcome: 'MAYBE', approver: null }],
    ['a lower-case outcome', { outcome: 'approved', approver }],
    ['a missing outcome', { approver: null }],
    ['an approved response without approver', { outcome: 'APPROVED', approver: null }],
    ['an approved response with a missing approver', { outcome: 'APPROVED' }],
    ['a denied response with an approver', { outcome: 'DENIED', approver }],
    ['a locked response with an approver', { outcome: 'LOCKED', approver }],
    ['a denied response with an undefined approver', { outcome: 'DENIED' }],
    [
      'an approver with an empty employee id',
      { outcome: 'APPROVED', approver: { ...approver, employeeId: '' } }
    ],
    [
      'an approver with a blank employee code',
      { outcome: 'APPROVED', approver: { ...approver, employeeCode: '   ' } }
    ],
    [
      'an approver with a non-string full name',
      { outcome: 'APPROVED', approver: { ...approver, fullName: 42 } }
    ],
    [
      'an approver missing its full name',
      {
        outcome: 'APPROVED',
        approver: { employeeId: approver.employeeId, employeeCode: approver.employeeCode }
      }
    ]
  ])('rejects %s', (_label, value) => {
    expect(isManagerApprovalVerificationResponse(value)).toBe(false);
  });
});
