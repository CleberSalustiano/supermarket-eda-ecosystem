import { ConflictError, EmployeeRole } from '@supermarket/shared-domain';

import { RegisterEmployeeUseCase } from './register-employee.use-case';
import {
  FakeCredentialHasher,
  FakeOutboxEventRelay,
  InMemoryManagementTransactionRunner
} from '../../../test/support/in-memory-management-test-doubles';

describe('RegisterEmployeeUseCase', () => {
  it('registers an employee, hashes the PIN, and queues the integration event', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const credentialHasher = new FakeCredentialHasher();
    const outboxEventRelay = new FakeOutboxEventRelay();
    const useCase = new RegisterEmployeeUseCase(
      credentialHasher,
      transactionRunner,
      outboxEventRelay
    );

    const response = await useCase.execute({
      tenantId: '8ea5ea2d-d2ef-40af-a673-d67d2fe30262',
      employeeCode: 'mg-01',
      fullName: 'John Manager',
      role: EmployeeRole.Manager,
      pin: '123456'
    });

    expect(response).toMatchObject({
      employeeCode: 'MG-01',
      role: EmployeeRole.Manager,
      eventPublicationStatus: 'published'
    });
    expect(transactionRunner.employeeRepository.all()[0]?.toPrimitives().pinHash).toBe('hashed:123456');
    expect(transactionRunner.outboxEventRepository.all()).toHaveLength(1);
  });

  it('rejects duplicate employee codes inside the same tenant', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const credentialHasher = new FakeCredentialHasher();
    const outboxEventRelay = new FakeOutboxEventRelay();
    const useCase = new RegisterEmployeeUseCase(
      credentialHasher,
      transactionRunner,
      outboxEventRelay
    );

    await useCase.execute({
      tenantId: '4601c7f8-5388-42d6-ad7f-cf1a5c9ec6b0',
      employeeCode: 'admin-1',
      fullName: 'Alice Admin',
      role: EmployeeRole.Admin,
      pin: '9876'
    });

    await expect(
      useCase.execute({
        tenantId: '4601c7f8-5388-42d6-ad7f-cf1a5c9ec6b0',
        employeeCode: 'admin-1',
        fullName: 'Another Admin',
        role: EmployeeRole.Admin,
        pin: '9876'
      })
    ).rejects.toThrow(
      new ConflictError(
        'Employee code ADMIN-1 is already registered for tenant 4601c7f8-5388-42d6-ad7f-cf1a5c9ec6b0'
      )
    );
  });
});
