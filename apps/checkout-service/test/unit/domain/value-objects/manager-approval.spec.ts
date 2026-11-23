import { DomainValidationError } from '@supermarket/shared-domain';

import { ManagerApproval } from '#/domain/value-objects/manager-approval';

describe('ManagerApproval', () => {
  it('keeps the trimmed approver identity', () => {
    const approval = ManagerApproval.create({
      employeeId: ' 7f0b1b9e-3c55-4b8a-9d55-1f6f7d2b9a01 ',
      employeeCode: ' MANAGER-01 ',
      fullName: ' Bruno Lima '
    });

    expect(approval.toPrimitives()).toEqual({
      employeeId: '7f0b1b9e-3c55-4b8a-9d55-1f6f7d2b9a01',
      employeeCode: 'MANAGER-01',
      fullName: 'Bruno Lima'
    });
  });

  it.each(['employeeId', 'employeeCode', 'fullName'] as const)(
    'rejects an empty %s',
    (field) => {
      expect(() =>
        ManagerApproval.create({
          employeeId: '7f0b1b9e-3c55-4b8a-9d55-1f6f7d2b9a01',
          employeeCode: 'MANAGER-01',
          fullName: 'Bruno Lima',
          [field]: '   '
        })
      ).toThrow(DomainValidationError);
    }
  );
});
