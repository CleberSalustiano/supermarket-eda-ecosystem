import { ConflictError, DomainValidationError, EmployeeRole } from '@supermarket/shared-domain';

import { Employee, SALE_CANCELLATION_APPROVER_ROLES } from '#/domain/entities/employee.entity';

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

  describe('lifecycle', () => {
    const createEmployee = () =>
      Employee.register({
        id: '6df32b6e-d46b-4342-bb35-20f491f84e11',
        tenantId: '72ac8252-18c8-4d9c-84ff-866f297a1d77',
        employeeCode: 'mg-01',
        fullName: 'John Manager',
        role: EmployeeRole.Manager,
        pinHash: 'salt:hash',
        createdAt: new Date('2026-11-01T10:00:00.000Z')
      });

    it('starts active with no deactivation date', () => {
      const employee = createEmployee();

      expect(employee.isActive()).toBe(true);
      expect(employee.toPrimitives().deactivatedAt).toBeNull();
    });

    it('deactivates logically and records the timestamps', () => {
      const employee = createEmployee();
      const at = new Date('2026-11-23T12:00:00.000Z');

      employee.deactivate(at);

      expect(employee.isActive()).toBe(false);
      expect(employee.toPrimitives()).toMatchObject({
        active: false,
        deactivatedAt: at.toISOString(),
        updatedAt: at.toISOString(),
        createdAt: '2026-11-01T10:00:00.000Z'
      });
    });

    it('rejects a second deactivation', () => {
      const employee = createEmployee();

      employee.deactivate(new Date());

      expect(() => employee.deactivate(new Date())).toThrow(
        new ConflictError('Employee MG-01 is already inactive')
      );
    });

    it('replaces the PIN hash and touches updatedAt', () => {
      const employee = createEmployee();
      const at = new Date('2026-11-23T12:00:00.000Z');

      employee.changePin('new:hash', at);

      expect(employee.toPrimitives()).toMatchObject({
        pinHash: 'new:hash',
        updatedAt: at.toISOString()
      });
    });

    it('rejects a PIN change for an inactive employee', () => {
      const employee = createEmployee();

      employee.deactivate(new Date());

      expect(() => employee.changePin('new:hash', new Date())).toThrow(
        new ConflictError('Employee MG-01 is inactive')
      );
    });

    it('rejects an empty PIN hash', () => {
      expect(() => createEmployee().changePin('  ', new Date())).toThrow(DomainValidationError);
    });

    it('rehydrates the deactivation state', () => {
      const deactivatedAt = new Date('2026-11-23T12:00:00.000Z');
      const employee = Employee.rehydrate({
        id: '6df32b6e-d46b-4342-bb35-20f491f84e11',
        tenantId: '72ac8252-18c8-4d9c-84ff-866f297a1d77',
        employeeCode: 'mg-01',
        fullName: 'John Manager',
        role: EmployeeRole.Manager,
        pinHash: 'salt:hash',
        active: false,
        deactivatedAt,
        createdAt: new Date('2026-11-01T10:00:00.000Z'),
        updatedAt: deactivatedAt
      });

      expect(employee.isActive()).toBe(false);
      expect(employee.toPrimitives().deactivatedAt).toBe(deactivatedAt.toISOString());
    });
  });

  describe('canApproveSaleCancellation', () => {
    const createWithRole = (role: EmployeeRole) =>
      Employee.register({
        id: '6df32b6e-d46b-4342-bb35-20f491f84e11',
        tenantId: '72ac8252-18c8-4d9c-84ff-866f297a1d77',
        employeeCode: 'emp-01',
        fullName: 'Approver Candidate',
        role,
        pinHash: 'salt:hash'
      });

    it('allows active managers and admins', () => {
      expect(createWithRole(EmployeeRole.Manager).canApproveSaleCancellation()).toBe(true);
      expect(createWithRole(EmployeeRole.Admin).canApproveSaleCancellation()).toBe(true);
      expect(SALE_CANCELLATION_APPROVER_ROLES).toEqual([EmployeeRole.Manager, EmployeeRole.Admin]);
    });

    it('rejects cashiers', () => {
      expect(createWithRole(EmployeeRole.Cashier).canApproveSaleCancellation()).toBe(false);
    });

    it('rejects an inactive manager', () => {
      const manager = createWithRole(EmployeeRole.Manager);

      manager.deactivate(new Date());

      expect(manager.canApproveSaleCancellation()).toBe(false);
    });
  });
});
