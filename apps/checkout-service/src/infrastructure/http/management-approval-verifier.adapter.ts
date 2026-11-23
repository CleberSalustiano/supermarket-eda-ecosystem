import {
  DependencyUnavailableError,
  isManagerApprovalVerificationResponse,
  MANAGER_APPROVAL_VERIFICATION_PATH,
  type ManagerApprovalApprover,
  type ManagerApprovalVerificationRequest,
  type ManagerApprovalVerificationResponse
} from '@supermarket/shared-domain';
import { CORRELATION_ID_HEADER } from '@supermarket/shared-infra';
import type { LoggerService } from '@nestjs/common';

import type {
  ManagerApprovalVerificationContext,
  ManagerApprovalVerifierPort
} from '#/application/ports/manager-approval-verifier.port';
import { MANAGER_APPROVAL_UNAVAILABLE_MESSAGE } from '#/application/ports/manager-approval-verifier.port';
import type { ManagementApprovalClientOptions } from '../config/management-approval-client.options';

export type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

type VerificationFailureReason = 'timeout' | 'network' | 'invalid response' | `status ${number}`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_APPROVER_EMPLOYEE_CODE_LENGTH = 32;
const MAX_APPROVER_FULL_NAME_LENGTH = 120;

/**
 * Verifies manager approvals against management-service's internal endpoint.
 *
 * Makes exactly one attempt per call, never retries, and turns every failure
 * (timeout, network error, non-200 status, contract violation) into a
 * `DependencyUnavailableError`. Neither the PIN nor the token is ever logged.
 */
export class ManagementApprovalVerifierAdapter implements ManagerApprovalVerifierPort {
  private readonly verificationUrl: string;

  constructor(
    private readonly options: ManagementApprovalClientOptions,
    private readonly logger: Pick<LoggerService, 'error'>,
    private readonly fetchFunction: FetchFunction = (input, init) => fetch(input, init)
  ) {
    this.verificationUrl = `${options.baseUrl}${MANAGER_APPROVAL_VERIFICATION_PATH}`;
  }

  async verify(
    request: ManagerApprovalVerificationRequest,
    context: ManagerApprovalVerificationContext
  ): Promise<ManagerApprovalVerificationResponse> {
    const signal = AbortSignal.timeout(this.options.timeoutMs);
    const response = await this.send(request, context, signal);

    if (response.status !== 200) {
      await discardBody(response);

      throw this.unavailable(`status ${response.status}`);
    }

    const body = await this.readJsonBody(response, signal);

    if (!isManagerApprovalVerificationResponse(body) || !hasPersistableApprover(body)) {
      throw this.unavailable('invalid response');
    }

    return {
      outcome: body.outcome,
      approver: body.approver
        ? {
            employeeId: body.approver.employeeId,
            employeeCode: body.approver.employeeCode,
            fullName: body.approver.fullName
          }
        : null
    };
  }

  private async send(
    request: ManagerApprovalVerificationRequest,
    context: ManagerApprovalVerificationContext,
    signal: AbortSignal
  ): Promise<Response> {
    try {
      return await this.fetchFunction(this.verificationUrl, {
        method: 'POST',
        headers: this.buildHeaders(context),
        body: JSON.stringify({
          tenantId: request.tenantId,
          approverCode: request.approverCode,
          pin: request.pin,
          registerId: request.registerId,
          saleId: request.saleId
        }),
        redirect: 'manual',
        signal
      });
    } catch (error) {
      throw this.unavailable(classifyTransportFailure(error, signal));
    }
  }

  /** The timeout signal still applies while the body streams in. */
  private async readJsonBody(response: Response, signal: AbortSignal): Promise<unknown> {
    let text: string;

    try {
      text = await response.text();
    } catch (error) {
      throw this.unavailable(classifyTransportFailure(error, signal));
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw this.unavailable('invalid response');
    }
  }

  private buildHeaders(context: ManagerApprovalVerificationContext): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${this.options.internalApiToken}`
    };

    if (context.correlationId) {
      headers[CORRELATION_ID_HEADER] = context.correlationId;
    }

    return headers;
  }

  private unavailable(reason: VerificationFailureReason): DependencyUnavailableError {
    const detail =
      reason === 'status 401' ? `${reason} (check MANAGEMENT_INTERNAL_API_TOKEN)` : reason;

    this.logger.error(`Manager approval verification failed: ${detail}`);

    return new DependencyUnavailableError(MANAGER_APPROVAL_UNAVAILABLE_MESSAGE);
  }
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The body is irrelevant for a failed verification; ignore stream errors.
  }
}

function classifyTransportFailure(error: unknown, signal: AbortSignal): 'timeout' | 'network' {
  return signal.aborted || hasErrorName(error, 'TimeoutError') ? 'timeout' : 'network';
}

/** `DOMException` is not always an `Error` instance across realms, so match by name. */
function hasErrorName(error: unknown, name: string): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === name;
}

/** Rejects approvers that the sale's columns could not store (uuid, 32 and 120 characters). */
function hasPersistableApprover(response: ManagerApprovalVerificationResponse): boolean {
  if (!response.approver) {
    return true;
  }

  return isPersistableApprover(response.approver);
}

function isPersistableApprover(approver: ManagerApprovalApprover): boolean {
  return (
    UUID_PATTERN.test(approver.employeeId) &&
    approver.employeeCode.trim().length <= MAX_APPROVER_EMPLOYEE_CODE_LENGTH &&
    approver.fullName.trim().length <= MAX_APPROVER_FULL_NAME_LENGTH
  );
}
