import { DomainValidationError, EmployeeRole } from '@supermarket/shared-domain';

import { Employee } from '#/domain/entities/employee.entity';

describe('Employee', () => {
  it('registers a valid employee with a normalized code', () => {
    const employee = Employee.register({
      id: '6df32b6e-d46b-4342-bb35-20f491f84e11',
      tenantId: '72ac8252-18c8-4d9c-84ff-866f297a1d77',
      employeeCode: 'cx-01',
      fullName: 'Mary Cashier',
      role: EmployeeRole.Cashier,
      pinHash: 'salt:hash'
    });

    expect(employee.toPrimitives()).toMatchObject({
      employeeCode: 'CX-01',
      fullName: 'Mary Cashier',
      role: EmployeeRole.Cashier,
      active: true
    });
  });

  it('rejects a PIN that does not meet the policy', () => {
    expect(() => Employee.assertRawPinMeetsPolicy('12ab')).toThrow(
      new DomainValidationError('PIN must contain between 4 and 12 digits')
    );
  });
});
