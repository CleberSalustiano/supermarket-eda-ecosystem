import { EmployeeRole } from '@supermarket/shared-domain';

import { ChangeEmployeePinUseCase } from '#/application/use-cases/change-employee-pin.use-case';
import { VerifyManagerApprovalUseCase } from '#/application/use-cases/verify-manager-approval.use-case';
import { Employee } from '#/domain/entities/employee.entity';
import { createManagerApprovalOptions } from '#/infrastructure/config/manager-approval.options';
import {
  FakeCredentialHasher,
  InMemoryManagementTransactionRunner
} from '../../../support/in-memory-management-test-doubles';

const TENANT = '8ea5ea2d-d2ef-40af-a673-d67d2fe30262';
const OTHER_TENANT = '4601c7f8-5388-42d6-ad7f-cf1a5c9ec6b0';
const SALE_ID = 'b1f0b5a4-1c2d-4e3f-8a9b-0c1d2e3f4a5b';
const REGISTER = 'register-01';
const MANAGER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const CASHIER_ID = '33333333-3333-4333-8333-333333333333';
const PIN = '1234';

describe('VerifyManagerApprovalUseCase', () => {
  async function setup() {
    const runner = new InMemoryManagementTransactionRunner();
    const hasher = new FakeCredentialHasher();
    const verifySpy = jest.spyOn(hasher, 'verify');

    for (const [id, code, role] of [
      [MANAGER_ID, 'mg-01', EmployeeRole.Manager],
      [ADMIN_ID, 'ad-01', EmployeeRole.Admin],
      [CASHIER_ID, 'cx-01', EmployeeRole.Cashier]
    ] as const) {
      await runner.employeeRepository.save(
        Employee.register({
          id,
          tenantId: TENANT,
          employeeCode: code,
          fullName: `Employee ${code}`,
          role,
          pinHash: `hashed:${PIN}`
        })
      );
    }

    const useCase = new VerifyManagerApprovalUseCase(
      hasher,
      runner,
      createManagerApprovalOptions({})
    );
    const verify = (
      overrides: Partial<{ tenantId: string; approverCode: string; pin: string; registerId: string }> = {}
    ) =>
      useCase.execute({
        tenantId: TENANT,
        approverCode: 'mg-01',
        pin: PIN,
        registerId: REGISTER,
        saleId: SALE_ID,
        ...overrides
      });
    const attempts = () =>
      runner.managerApprovalAttemptRepository.all().map((attempt) => attempt.toPrimitives());

    return { runner, hasher, verifySpy, verify, attempts };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    ['MANAGER', 'mg-01', MANAGER_ID],
    ['ADMIN', ' ad-01 ', ADMIN_ID]
  ])('approves an active %s and audits it', async (_role, approverCode, employeeId) => {
    const { verify, attempts } = await setup();

    const result = await verify({ approverCode });
    const code = approverCode.trim().toUpperCase();

    expect(result).toEqual({
      outcome: 'APPROVED',
      approver: { employeeId, employeeCode: code, fullName: `Employee ${approverCode.trim()}` }
    });
    expect(attempts()).toEqual([
      expect.objectContaining({
        tenantId: TENANT,
        approverCode: code,
        employeeId,
        registerId: REGISTER,
        saleId: SALE_ID,
        outcome: 'APPROVED',
        reason: null
      })
    ]);
  });

  it('denies an unknown code with UNKNOWN_CODE and still runs verify against null', async () => {
    const { verify, verifySpy, attempts } = await setup();

    const result = await verify({ approverCode: 'nobody' });

    expect(result).toEqual({ outcome: 'DENIED', approver: null });
    expect(verifySpy).toHaveBeenCalledWith(PIN, null);
    expect(attempts()).toEqual([
      expect.objectContaining({
        approverCode: 'NOBODY',
        employeeId: null,
        outcome: 'DENIED',
        reason: 'UNKNOWN_CODE'
      })
    ]);
  });

  it('denies a wrong PIN with WRONG_PIN', async () => {
    const { verify, attempts } = await setup();

    expect(await verify({ pin: '9999' })).toEqual({ outcome: 'DENIED', approver: null });
    expect(attempts()[0]).toMatchObject({ employeeId: MANAGER_ID, reason: 'WRONG_PIN' });
  });

  it('denies a cashier with NOT_APPROVER even with the right PIN', async () => {
    const { verify, attempts } = await setup();

    expect(await verify({ approverCode: 'cx-01' })).toEqual({ outcome: 'DENIED', approver: null });
    expect(attempts()[0]).toMatchObject({ employeeId: CASHIER_ID, reason: 'NOT_APPROVER' });
  });

  it('denies an inactive manager with INACTIVE, and WRONG_PIN takes precedence', async () => {
    const { runner, verify, attempts } = await setup();
    const manager = await runner.employeeRepository.findById(TENANT, MANAGER_ID);

    manager!.deactivate(new Date());
    await runner.employeeRepository.save(manager!);

    expect(await verify()).toEqual({ outcome: 'DENIED', approver: null });
    expect(await verify({ pin: '9999' })).toEqual({ outcome: 'DENIED', approver: null });
    expect(attempts().map((attempt) => attempt.reason)).toEqual(['INACTIVE', 'WRONG_PIN']);
  });

  it('locks the code throttle before the register throttle', async () => {
    const { runner, verify } = await setup();

    await verify();
    await verify({ approverCode: 'nobody', registerId: 'register-02' });

    expect(runner.approvalThrottleRepository.lockedKeys).toEqual([
      `${TENANT}|APPROVER_CODE|MG-01`,
      `${TENANT}|REGISTER|${REGISTER}`,
      `${TENANT}|APPROVER_CODE|NOBODY`,
      `${TENANT}|REGISTER|register-02`
    ]);
  });

  it('locks a code after 5 failures and answers LOCKED even with the correct PIN', async () => {
    const { verify, verifySpy, attempts } = await setup();

    for (let failure = 0; failure < 5; failure += 1) {
      expect(await verify({ pin: '9999' })).toEqual({ outcome: 'DENIED', approver: null });
    }

    verifySpy.mockClear();

    expect(await verify()).toEqual({ outcome: 'LOCKED', approver: null });
    expect(verifySpy).not.toHaveBeenCalled();
    expect(attempts().at(-1)).toMatchObject({
      outcome: 'LOCKED',
      reason: 'CODE_LOCKED',
      employeeId: null
    });
    // The same register still approves another approver.
    expect((await verify({ approverCode: 'ad-01' })).outcome).toBe('APPROVED');
  });

  it('unlocks a code once the lockout has elapsed', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-23T10:00:00.000Z') });
    const { verify } = await setup();

    for (let failure = 0; failure < 5; failure += 1) {
      await verify({ pin: '9999' });
    }

    jest.setSystemTime(new Date('2026-11-23T10:14:59.999Z'));
    expect((await verify()).outcome).toBe('LOCKED');

    jest.setSystemTime(new Date('2026-11-23T10:15:00.000Z'));
    expect((await verify()).outcome).toBe('APPROVED');
  });

  it('resets the code counter on success but never the register counter', async () => {
    const { runner, verify } = await setup();

    for (let failure = 0; failure < 4; failure += 1) {
      await verify({ pin: '9999' });
    }

    expect((await verify()).outcome).toBe('APPROVED');
    expect(
      runner.approvalThrottleRepository.get(TENANT, 'APPROVER_CODE', 'MG-01')?.toPrimitives()
    ).toMatchObject({ failureCount: 0, lockedUntil: null });
    expect(
      runner.approvalThrottleRepository.get(TENANT, 'REGISTER', REGISTER)?.toPrimitives()
    ).toMatchObject({ failureCount: 4, lockedUntil: null });

    // Four more failures stay below the code limit again.
    for (let failure = 0; failure < 4; failure += 1) {
      expect((await verify({ pin: '9999' })).outcome).toBe('DENIED');
    }
  });

  it('applies a register lock across different codes after 10 failures', async () => {
    const { verify, attempts } = await setup();

    for (let failure = 0; failure < 10; failure += 1) {
      expect((await verify({ approverCode: `unknown-${failure}` })).outcome).toBe('DENIED');
    }

    expect(await verify()).toEqual({ outcome: 'LOCKED', approver: null });
    expect(attempts().at(-1)).toMatchObject({ outcome: 'LOCKED', reason: 'REGISTER_LOCKED' });
    // Another register is unaffected.
    expect((await verify({ registerId: 'register-02' })).outcome).toBe('APPROVED');
  });

  it('reports CODE_LOCKED when both the code and the register are locked', async () => {
    const { verify, attempts } = await setup();

    for (let failure = 0; failure < 5; failure += 1) {
      await verify({ pin: '9999' });
    }

    for (let failure = 0; failure < 5; failure += 1) {
      await verify({ approverCode: `unknown-${failure}` });
    }

    expect((await verify()).outcome).toBe('LOCKED');
    expect(attempts().at(-1)).toMatchObject({ reason: 'CODE_LOCKED' });
  });

  it('keeps throttles and employees isolated per tenant', async () => {
    const { verify } = await setup();

    for (let failure = 0; failure < 5; failure += 1) {
      await verify({ pin: '9999' });
    }

    expect((await verify({ tenantId: OTHER_TENANT })).outcome).toBe('DENIED');
    expect((await verify()).outcome).toBe('LOCKED');
  });

  it('clears the code lock when the employee changes PIN', async () => {
    const { runner, hasher, verify } = await setup();

    for (let failure = 0; failure < 5; failure += 1) {
      await verify({ pin: '9999' });
    }

    expect((await verify()).outcome).toBe('LOCKED');

    await new ChangeEmployeePinUseCase(hasher, runner).execute({
      tenantId: TENANT,
      employeeId: MANAGER_ID,
      pin: '5678'
    });

    expect((await verify()).outcome).toBe('DENIED');
    expect((await verify({ pin: '5678' })).outcome).toBe('APPROVED');
  });

  it('never stores or returns the PIN', async () => {
    const { verify, attempts } = await setup();
    const results = [
      await verify({ pin: '87654321' }),
      await verify({ approverCode: 'nobody', pin: '87654321' }),
      await verify()
    ];

    expect(JSON.stringify(results)).not.toContain('87654321');
    expect(JSON.stringify(attempts())).not.toMatch(/87654321|hashed:/);
  });
});
