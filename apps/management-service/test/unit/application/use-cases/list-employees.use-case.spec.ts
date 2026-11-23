import { DomainValidationError, EmployeeRole } from '@supermarket/shared-domain';

import { Employee } from '#/domain/entities/employee.entity';
import { ListEmployeesUseCase } from '#/application/use-cases/list-employees.use-case';
import { InMemoryManagementTransactionRunner } from '../../../support/in-memory-management-test-doubles';

const TENANT_A = '8ea5ea2d-d2ef-40af-a673-d67d2fe30262';
const TENANT_B = '4601c7f8-5388-42d6-ad7f-cf1a5c9ec6b0';

function employee(id: string, tenantId: string, code: string, active = true): Employee {
  const created = Employee.register({
    id,
    tenantId,
    employeeCode: code,
    fullName: `Employee ${code}`,
    role: EmployeeRole.Cashier,
    pinHash: 'secret-salt:secret-hash'
  });

  if (!active) {
    created.deactivate(new Date());
  }

  return created;
}

describe('ListEmployeesUseCase', () => {
  async function setup() {
    const runner = new InMemoryManagementTransactionRunner();

    await runner.employeeRepository.save(employee('11111111-1111-4111-8111-111111111111', TENANT_A, 'C-03'));
    await runner.employeeRepository.save(employee('22222222-2222-4222-8222-222222222222', TENANT_A, 'C-01'));
    await runner.employeeRepository.save(employee('33333333-3333-4333-8333-333333333333', TENANT_A, 'C-02', false));
    await runner.employeeRepository.save(employee('44444444-4444-4444-8444-444444444444', TENANT_B, 'B-01'));

    return new ListEmployeesUseCase(runner);
  }

  it('lists all employees of the tenant ordered by code, with defaults', async () => {
    const result = await (await setup()).execute({ tenantId: TENANT_A });

    expect(result).toMatchObject({ total: 3, limit: 50, offset: 0 });
    expect(result.items.map((item) => item.employeeCode)).toEqual(['C-01', 'C-02', 'C-03']);
  });

  it('filters by status', async () => {
    const useCase = await setup();

    expect(
      (await useCase.execute({ tenantId: TENANT_A, status: 'inactive' })).items.map(
        (item) => item.employeeCode
      )
    ).toEqual(['C-02']);
    expect((await useCase.execute({ tenantId: TENANT_A, status: 'active' })).total).toBe(2);
  });

  it('paginates', async () => {
    const result = await (await setup()).execute({ tenantId: TENANT_A, limit: 1, offset: 1 });

    expect(result.total).toBe(3);
    expect(result.items.map((item) => item.employeeCode)).toEqual(['C-02']);
  });

  it('never exposes PIN data', async () => {
    const result = await (await setup()).execute({ tenantId: TENANT_A });

    expect(JSON.stringify(result)).not.toMatch(/pinHash|secret-hash|secret-salt/);
  });

  it.each([{ limit: 0 }, { limit: 201 }, { limit: 1.5 }, { offset: -1 }])(
    'rejects invalid paging %p',
    async (paging) => {
      await expect((await setup()).execute({ tenantId: TENANT_A, ...paging })).rejects.toThrow(
        DomainValidationError
      );
    }
  );
});
