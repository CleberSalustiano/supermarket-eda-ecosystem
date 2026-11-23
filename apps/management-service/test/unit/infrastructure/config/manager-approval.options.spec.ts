import { createManagerApprovalOptions } from '#/infrastructure/config/manager-approval.options';
import { createManagementInternalApiTokens } from '#/infrastructure/config/internal-api.options';

const MINUTE = 60_000;

describe('createManagerApprovalOptions', () => {
  it('uses the D3 defaults', () => {
    const options = createManagerApprovalOptions({});

    expect(options.approverCodePolicy).toMatchObject({
      maxFailures: 5,
      windowMs: 15 * MINUTE,
      lockoutMs: 15 * MINUTE,
      resetOnSuccess: true
    });
    expect(options.registerPolicy).toMatchObject({
      maxFailures: 10,
      windowMs: 15 * MINUTE,
      lockoutMs: 15 * MINUTE,
      resetOnSuccess: false
    });
  });

  it('reads every value from the environment', () => {
    const options = createManagerApprovalOptions({
      MANAGER_APPROVAL_CODE_MAX_FAILURES: '3',
      MANAGER_APPROVAL_CODE_WINDOW_MINUTES: '10',
      MANAGER_APPROVAL_CODE_LOCKOUT_MINUTES: '30',
      MANAGER_APPROVAL_REGISTER_MAX_FAILURES: '20',
      MANAGER_APPROVAL_REGISTER_WINDOW_MINUTES: '5',
      MANAGER_APPROVAL_REGISTER_LOCKOUT_MINUTES: '60'
    });

    expect(options.approverCodePolicy).toMatchObject({
      maxFailures: 3,
      windowMs: 10 * MINUTE,
      lockoutMs: 30 * MINUTE
    });
    expect(options.registerPolicy).toMatchObject({
      maxFailures: 20,
      windowMs: 5 * MINUTE,
      lockoutMs: 60 * MINUTE
    });
  });

  it.each([
    'MANAGER_APPROVAL_CODE_MAX_FAILURES',
    'MANAGER_APPROVAL_CODE_WINDOW_MINUTES',
    'MANAGER_APPROVAL_CODE_LOCKOUT_MINUTES',
    'MANAGER_APPROVAL_REGISTER_MAX_FAILURES',
    'MANAGER_APPROVAL_REGISTER_WINDOW_MINUTES',
    'MANAGER_APPROVAL_REGISTER_LOCKOUT_MINUTES'
  ])('throws at boot when %s is not a positive integer', (variable) => {
    for (const invalid of ['0', '-1', '1.5', 'abc', '5abc', '999999999999999']) {
      expect(() => createManagerApprovalOptions({ [variable]: invalid })).toThrow(
        `${variable} must be a positive integer`
      );
    }
  });
});

describe('createManagementInternalApiTokens', () => {
  const token = 'a'.repeat(32);

  it('requires MANAGEMENT_INTERNAL_API_TOKENS outside test', () => {
    expect(() => createManagementInternalApiTokens({}, 'development')).toThrow(
      'MANAGEMENT_INTERNAL_API_TOKENS is required'
    );
    expect(() => createManagementInternalApiTokens({}, 'production')).toThrow(
      'MANAGEMENT_INTERNAL_API_TOKENS is required'
    );
  });

  it('rejects an invalid token without echoing it', () => {
    expect(() =>
      createManagementInternalApiTokens({ MANAGEMENT_INTERNAL_API_TOKENS: 'short-secret' }, 'production')
    ).toThrow(/^(?!.*short-secret).*MANAGEMENT_INTERNAL_API_TOKENS must contain tokens/);
  });

  it('accepts several tokens for rotation and allows none under test', () => {
    expect(
      createManagementInternalApiTokens(
        { MANAGEMENT_INTERNAL_API_TOKENS: `${token}, ${'b'.repeat(40)}` },
        'production'
      )
    ).toEqual([token, 'b'.repeat(40)]);
    expect(createManagementInternalApiTokens({}, 'test')).toEqual([]);
  });
});
