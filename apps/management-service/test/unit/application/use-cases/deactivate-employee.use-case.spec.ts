import { ConflictError, EmployeeRole, ResourceNotFoundError } from '@supermarket/shared-domain';

import { Employee } from '#/domain/entities/employee.entity';
import { DeactivateEmployeeUseCase } from '#/application/use-cases/deactivate-employee.use-case';
import { InMemoryManagementTransactionRunner } from '../../../support/in-memory-management-test-doubles';

const TENANT = '8ea5ea2d-d2ef-40af-a673-d67d2fe30262';
const EMPLOYEE_ID = '11111111-1111-4111-8111-111111111111';

describe('DeactivateEmployeeUseCase', () => {
  async function setup() {
    const runner = new InMemoryManagementTransactionRunner();

    await runner.employeeRepository.save(
      Employee.register({
        id: EMPLOYEE_ID,
        tenantId: TENANT,
        employeeCode: 'mg-01',
        fullName: 'John Manager',
        role: EmployeeRole.Manager,
        pinHash: 'secret-salt:secret-hash'
      })
    );

    return { runner, useCase: new DeactivateEmployeeUseCase(runner) };
  }

  it('deactivates and appends a DEACTIVATED audit entry', async () => {
    const { runner, useCase } = await setup();

    const view = await useCase.execute({ tenantId: TENANT, employeeId: EMPLOYEE_ID });

    expect(view).toMatchObject({ employeeCode: 'MG-01', active: false });
    expect(view.deactivatedAt).not.toBeNull();
    expect(JSON.stringify(view)).not.toMatch(/pinHash|secret/);
    expect(runner.employeeAuditEntryRepository.all().map((entry) => entry.toPrimitives())).toEqual([
      expect.objectContaining({
        tenantId: TENANT,
        employeeId: EMPLOYEE_ID,
        employeeCode: 'MG-01',
        action: 'DEACTIVATED'
      })
    ]);
    expect(runner.employeeRepository.all()[0]?.isActive()).toBe(false);
  });

  it('returns not found for an unknown employee or another tenant', async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({ tenantId: '4601c7f8-5388-42d6-ad7f-cf1a5c9ec6b0', employeeId: EMPLOYEE_ID })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('conflicts when already inactive and appends no second audit entry', async () => {
    const { runner, useCase } = await setup();

    await useCase.execute({ tenantId: TENANT, employeeId: EMPLOYEE_ID });

    await expect(
      useCase.execute({ tenantId: TENANT, employeeId: EMPLOYEE_ID })
    ).rejects.toBeInstanceOf(ConflictError);
    expect(runner.employeeAuditEntryRepository.all()).toHaveLength(1);
  });
});
