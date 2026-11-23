import {
  ConflictError,
  DomainValidationError,
  EmployeeRole,
  ResourceNotFoundError
} from '@supermarket/shared-domain';

import { Employee } from '#/domain/entities/employee.entity';
import { ChangeEmployeePinUseCase } from '#/application/use-cases/change-employee-pin.use-case';
import { createManagerApprovalOptions } from '#/infrastructure/config/manager-approval.options';
import {
  FakeCredentialHasher,
  InMemoryManagementTransactionRunner
} from '../../../support/in-memory-management-test-doubles';

const TENANT = '8ea5ea2d-d2ef-40af-a673-d67d2fe30262';
const EMPLOYEE_ID = '11111111-1111-4111-8111-111111111111';

describe('ChangeEmployeePinUseCase', () => {
  async function setup() {
    const runner = new InMemoryManagementTransactionRunner();

    await runner.employeeRepository.save(
      Employee.register({
        id: EMPLOYEE_ID,
        tenantId: TENANT,
        employeeCode: 'mg-01',
        fullName: 'John Manager',
        role: EmployeeRole.Manager,
        pinHash: 'hashed:1234'
      })
    );

    return { runner, useCase: new ChangeEmployeePinUseCase(new FakeCredentialHasher(), runner) };
  }

  it('stores the new hash and appends a PIN_CHANGED audit entry without any PIN', async () => {
    const { runner, useCase } = await setup();

    const output = await useCase.execute({ tenantId: TENANT, employeeId: EMPLOYEE_ID, pin: '987654' });

    expect(output).toMatchObject({ employeeId: EMPLOYEE_ID, tenantId: TENANT, employeeCode: 'MG-01' });
    expect(Object.keys(output).sort()).toEqual([
      'employeeCode',
      'employeeId',
      'pinChangedAt',
      'tenantId'
    ]);
    expect(runner.employeeRepository.all()[0]?.toPrimitives().pinHash).toBe('hashed:987654');

    const audit = runner.employeeAuditEntryRepository.all().map((entry) => entry.toPrimitives());

    expect(audit).toEqual([expect.objectContaining({ action: 'PIN_CHANGED', employeeCode: 'MG-01' })]);
    expect(JSON.stringify(audit)).not.toMatch(/987654|hashed/);
  });

  it('rejects a PIN equal to the current one', async () => {
    const { runner, useCase } = await setup();

    await expect(
      useCase.execute({ tenantId: TENANT, employeeId: EMPLOYEE_ID, pin: '1234' })
    ).rejects.toThrow(new DomainValidationError('New PIN must differ from the current PIN'));
    expect(runner.employeeAuditEntryRepository.all()).toHaveLength(0);
  });

  it('rejects a PIN outside the policy', async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({ tenantId: TENANT, employeeId: EMPLOYEE_ID, pin: '12ab' })
    ).rejects.toBeInstanceOf(DomainValidationError);
  });

  it('returns not found for an unknown employee', async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({
        tenantId: TENANT,
        employeeId: '22222222-2222-4222-8222-222222222222',
        pin: '987654'
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('conflicts for an inactive employee', async () => {
    const { runner, useCase } = await setup();

    runner.employeeRepository.all()[0]?.deactivate(new Date());

    await expect(
      useCase.execute({ tenantId: TENANT, employeeId: EMPLOYEE_ID, pin: '987654' })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('clears only the employee approver-code lock in the same transaction', async () => {
    const { runner, useCase } = await setup();
    const codeThrottle = await runner.approvalThrottleRepository.findForUpdate(
      TENANT,
      'APPROVER_CODE',
      'MG-01'
    );
    const registerThrottle = await runner.approvalThrottleRepository.findForUpdate(
      TENANT,
      'REGISTER',
      'register-01'
    );
    const policy = createManagerApprovalOptions({ MANAGER_APPROVAL_CODE_MAX_FAILURES: '1' });
    const now = new Date();

    codeThrottle.registerFailure(now, policy.approverCodePolicy);
    registerThrottle.registerFailure(now, policy.registerPolicy);
    await runner.approvalThrottleRepository.save(codeThrottle);
    await runner.approvalThrottleRepository.save(registerThrottle);

    await useCase.execute({ tenantId: TENANT, employeeId: EMPLOYEE_ID, pin: '987654' });

    expect(runner.approvalThrottleRepository.clearedKeys).toEqual([`${TENANT}|APPROVER_CODE|MG-01`]);
    expect(
      runner.approvalThrottleRepository.get(TENANT, 'APPROVER_CODE', 'MG-01')?.isLocked(now)
    ).toBe(false);
    expect(
      runner.approvalThrottleRepository.get(TENANT, 'REGISTER', 'register-01')?.toPrimitives()
        .failureCount
    ).toBe(1);
  });

  it('does not clear any lock when the PIN change is rejected', async () => {
    const { runner, useCase } = await setup();

    await expect(
      useCase.execute({ tenantId: TENANT, employeeId: EMPLOYEE_ID, pin: '1234' })
    ).rejects.toBeInstanceOf(DomainValidationError);
    expect(runner.approvalThrottleRepository.clearedKeys).toEqual([]);
  });
});
