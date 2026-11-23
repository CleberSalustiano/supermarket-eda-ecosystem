import {
  DependencyUnavailableError,
  type ManagerApprovalVerificationRequest
} from '@supermarket/shared-domain';

import { MANAGER_APPROVAL_UNAVAILABLE_MESSAGE } from '#/application/ports/manager-approval-verifier.port';
import {
  type FetchFunction,
  ManagementApprovalVerifierAdapter
} from '#/infrastructure/http/management-approval-verifier.adapter';

const token = 'tok_0123456789abcdefghijklmnopqrstuvwxyz';
const pin = '864209';
const request: ManagerApprovalVerificationRequest = {
  tenantId: 'e8197b86-cff7-406b-b879-c3810a8e731d',
  approverCode: 'MANAGER-01',
  pin,
  registerId: 'register-09',
  saleId: '3aeb9ee2-2772-47ea-b7be-0d3723e749d0'
};
const approver = {
  employeeId: '9a4d2f7e-58a1-4c7b-8e1f-2b3c4d5e6f70',
  employeeCode: 'MANAGER-01',
  fullName: 'Bruno Lima'
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function createAdapter(fetchFunction: FetchFunction, timeoutMs = 2000) {
  const logger = { error: jest.fn() };
  const fetchMock = jest.fn(fetchFunction);
  const adapter = new ManagementApprovalVerifierAdapter(
    { baseUrl: 'http://management.internal:3003', internalApiToken: token, timeoutMs },
    logger,
    fetchMock
  );

  return { adapter, fetchMock, logger };
}

function expectNoSecretsLogged(logger: { error: jest.Mock }): void {
  const logged = JSON.stringify(logger.error.mock.calls);

  expect(logged).not.toContain(pin);
  expect(logged).not.toContain(token);
}

describe('ManagementApprovalVerifierAdapter', () => {
  it('posts the exact body with the bearer token and correlation id', async () => {
    const { adapter, fetchMock, logger } = createAdapter(async () =>
      jsonResponse({ outcome: 'APPROVED', approver })
    );

    const response = await adapter.verify(request, { correlationId: 'corr-42' });

    expect(response).toEqual({ outcome: 'APPROVED', approver });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;

    expect(url).toBe('http://management.internal:3003/internal/manager-approvals/verifications');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'x-correlation-id': 'corr-42'
    });
    expect(JSON.parse(init.body as string)).toEqual(request);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.redirect).toBe('manual');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('omits the correlation header when there is none', async () => {
    const { adapter, fetchMock } = createAdapter(async () =>
      jsonResponse({ outcome: 'DENIED', approver: null })
    );

    await adapter.verify(request, {});

    expect(fetchMock.mock.calls[0]![1].headers).not.toHaveProperty('x-correlation-id');
  });

  it.each([
    [{ outcome: 'DENIED', approver: null }],
    [{ outcome: 'LOCKED', approver: null }]
  ])('returns the %p business outcome', async (body) => {
    const { adapter } = createAdapter(async () => jsonResponse(body));

    await expect(adapter.verify(request, {})).resolves.toEqual(body);
  });

  it('returns only the contract fields', async () => {
    const { adapter } = createAdapter(async () =>
      jsonResponse({ outcome: 'APPROVED', approver: { ...approver, role: 'MANAGER' }, extra: 1 })
    );

    await expect(adapter.verify(request, {})).resolves.toEqual({
      outcome: 'APPROVED',
      approver
    });
  });

  it('gives DependencyUnavailableError on timeout and aborts the request', async () => {
    let receivedSignal: AbortSignal | undefined;
    const { adapter, fetchMock, logger } = createAdapter(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          receivedSignal = init.signal ?? undefined;
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
      20
    );

    await expect(adapter.verify(request, {})).rejects.toThrow(
      new DependencyUnavailableError(MANAGER_APPROVAL_UNAVAILABLE_MESSAGE)
    );
    expect(receivedSignal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Manager approval verification failed: timeout');
    expectNoSecretsLogged(logger);
  });

  it('gives DependencyUnavailableError on a network error', async () => {
    const { adapter, fetchMock, logger } = createAdapter(async () => {
      throw new TypeError('fetch failed');
    });

    await expect(adapter.verify(request, {})).rejects.toThrow(DependencyUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Manager approval verification failed: network');
    expectNoSecretsLogged(logger);
  });

  it.each([
    [401, 'Manager approval verification failed: status 401 (check MANAGEMENT_INTERNAL_API_TOKEN)'],
    [400, 'Manager approval verification failed: status 400'],
    [403, 'Manager approval verification failed: status 403'],
    [500, 'Manager approval verification failed: status 500'],
    [503, 'Manager approval verification failed: status 503'],
    [302, 'Manager approval verification failed: status 302'],
    [201, 'Manager approval verification failed: status 201']
  ])('gives DependencyUnavailableError for status %i', async (status, logMessage) => {
    const { adapter, fetchMock, logger } = createAdapter(async () =>
      jsonResponse({ outcome: 'APPROVED', approver }, status)
    );

    await expect(adapter.verify(request, {})).rejects.toThrow(
      new DependencyUnavailableError(MANAGER_APPROVAL_UNAVAILABLE_MESSAGE)
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(logMessage);
    expectNoSecretsLogged(logger);
  });

  it.each([
    ['a non-JSON body', 'not json'],
    ['an unknown outcome', { outcome: 'MAYBE', approver: null }],
    ['APPROVED without an approver', { outcome: 'APPROVED', approver: null }],
    ['DENIED without the approver field', { outcome: 'DENIED' }],
    ['DENIED with an approver', { outcome: 'DENIED', approver }],
    ['a blank approver name', { outcome: 'APPROVED', approver: { ...approver, fullName: ' ' } }],
    [
      'a non-uuid employee id',
      { outcome: 'APPROVED', approver: { ...approver, employeeId: 'employee-1' } }
    ],
    [
      'an employee code longer than 32 characters',
      { outcome: 'APPROVED', approver: { ...approver, employeeCode: 'M'.repeat(33) } }
    ],
    [
      'a full name longer than 120 characters',
      { outcome: 'APPROVED', approver: { ...approver, fullName: 'N'.repeat(121) } }
    ],
    ['an array', []],
    ['null', null]
  ])('gives DependencyUnavailableError for %s', async (_label, body) => {
    const { adapter, fetchMock, logger } = createAdapter(async () => jsonResponse(body));

    await expect(adapter.verify(request, {})).rejects.toThrow(DependencyUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Manager approval verification failed: invalid response'
    );
    expectNoSecretsLogged(logger);
  });

  it('never puts the PIN or the token in the error', async () => {
    const { adapter } = createAdapter(async () => jsonResponse({ message: pin }, 500));

    const error = await adapter.verify(request, {}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DependencyUnavailableError);
    expect(JSON.stringify(error)).not.toContain(pin);
    expect(String((error as Error).message)).not.toContain(pin);
    expect(String((error as Error).message)).not.toContain(token);
  });
});
