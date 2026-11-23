import { createManagementApprovalClientOptions } from '#/infrastructure/config/management-approval-client.options';

const token = 'a'.repeat(64);

describe('createManagementApprovalClientOptions', () => {
  it('uses the local defaults in development when only the token is set', () => {
    expect(
      createManagementApprovalClientOptions('development', {
        MANAGEMENT_INTERNAL_API_TOKEN: token
      })
    ).toEqual({
      baseUrl: 'http://localhost:3003',
      internalApiToken: token,
      timeoutMs: 2000
    });
  });

  it('allows a missing token and URL in test', () => {
    expect(createManagementApprovalClientOptions('test', {})).toEqual({
      baseUrl: 'http://localhost:3003',
      internalApiToken: '',
      timeoutMs: 2000
    });
  });

  it('reads explicit values', () => {
    expect(
      createManagementApprovalClientOptions('production', {
        MANAGEMENT_SERVICE_BASE_URL: ' https://management.internal:8443/api ',
        MANAGEMENT_INTERNAL_API_TOKEN: ` ${token} `,
        MANAGEMENT_APPROVAL_TIMEOUT_MS: '750'
      })
    ).toEqual({
      baseUrl: 'https://management.internal:8443/api',
      internalApiToken: token,
      timeoutMs: 750
    });
  });

  it('requires the URL in production', () => {
    expect(() =>
      createManagementApprovalClientOptions('production', {
        MANAGEMENT_INTERNAL_API_TOKEN: token
      })
    ).toThrow('MANAGEMENT_SERVICE_BASE_URL is required');
  });

  it.each(['development', 'production'] as const)(
    'requires the token in %s',
    (nodeEnvironment) => {
      expect(() =>
        createManagementApprovalClientOptions(nodeEnvironment, {
          MANAGEMENT_SERVICE_BASE_URL: 'http://localhost:3003',
          MANAGEMENT_INTERNAL_API_TOKEN: ''
        })
      ).toThrow('MANAGEMENT_INTERNAL_API_TOKEN is required');
    }
  );

  it('rejects an invalid token without echoing it', () => {
    const shortToken = 'short-secret';

    expect(() =>
      createManagementApprovalClientOptions('test', {
        MANAGEMENT_INTERNAL_API_TOKEN: shortToken
      })
    ).toThrow('MANAGEMENT_INTERNAL_API_TOKEN must contain tokens of at least 32 URL-safe characters');

    try {
      createManagementApprovalClientOptions('test', { MANAGEMENT_INTERNAL_API_TOKEN: shortToken });
    } catch (error) {
      expect((error as Error).message).not.toContain(shortToken);
    }
  });

  it('rejects several tokens', () => {
    expect(() =>
      createManagementApprovalClientOptions('development', {
        MANAGEMENT_INTERNAL_API_TOKEN: `${token},${'b'.repeat(64)}`
      })
    ).toThrow('MANAGEMENT_INTERNAL_API_TOKEN must contain exactly one token');
  });

  it.each([
    'http://localhost:3003/',
    'ftp://localhost:3003',
    'localhost:3003',
    'not a url',
    'http://user:secret@localhost:3003',
    'http://localhost:3003?x=1',
    'http://localhost:3003#fragment'
  ])('rejects the base URL %s', (baseUrl) => {
    expect(() =>
      createManagementApprovalClientOptions('development', {
        MANAGEMENT_SERVICE_BASE_URL: baseUrl,
        MANAGEMENT_INTERNAL_API_TOKEN: token
      })
    ).toThrow(/^MANAGEMENT_SERVICE_BASE_URL must be an http\(s\) URL/);
  });

  it.each(['100', '10000'])('accepts the timeout bound %s', (timeout) => {
    expect(
      createManagementApprovalClientOptions('test', {
        MANAGEMENT_APPROVAL_TIMEOUT_MS: timeout
      }).timeoutMs
    ).toBe(Number(timeout));
  });

  it.each(['99', '10001', '0', '-5', '1.5', '2s', 'abc'])(
    'rejects the timeout %s',
    (timeout) => {
      expect(() =>
        createManagementApprovalClientOptions('test', {
          MANAGEMENT_APPROVAL_TIMEOUT_MS: timeout
        })
      ).toThrow('MANAGEMENT_APPROVAL_TIMEOUT_MS must be an integer from 100 to 10000');
    }
  );
});
