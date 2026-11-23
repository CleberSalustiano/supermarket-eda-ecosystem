import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import type {
  VerifyManagerApprovalInputDto,
  VerifyManagerApprovalOutputDto
} from '../dto/verify-manager-approval.dto';
import type { CredentialHasherPort } from '../ports/credential-hasher.port';
import { CREDENTIAL_HASHER } from '../ports/credential-hasher.port';
import type { ManagerApprovalOptions } from '../ports/manager-approval.options';
import { MANAGER_APPROVAL_OPTIONS } from '../ports/manager-approval.options';
import type { ManagementTransactionRunnerPort } from '../ports/management-transaction-runner.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '../ports/management-transaction-runner.port';
import {
  ManagerApprovalAttempt,
  type ManagerApprovalAttemptReason
} from '#/domain/entities/manager-approval-attempt.entity';
import { decideManagerApproval } from '#/domain/services/manager-approval-decision';

/**
 * Verifies an approver code + PIN for a post-payment sale cancellation.
 *
 * Runs in one transaction. The approver-code throttle row is always locked
 * before the register throttle row (fixed order, so concurrent attempts cannot
 * deadlock), which serialises attempts per code and per register and keeps the
 * lockout counters exact. The PIN is never logged, persisted or returned.
 */
@Injectable()
export class VerifyManagerApprovalUseCase {
  constructor(
    @Inject(CREDENTIAL_HASHER)
    private readonly credentialHasher: CredentialHasherPort,
    @Inject(MANAGEMENT_TRANSACTION_RUNNER)
    private readonly transactionRunner: ManagementTransactionRunnerPort,
    @Inject(MANAGER_APPROVAL_OPTIONS)
    private readonly options: ManagerApprovalOptions
  ) {}

  async execute(input: VerifyManagerApprovalInputDto): Promise<VerifyManagerApprovalOutputDto> {
    const approverCode = input.approverCode.trim().toUpperCase();

    return this.transactionRunner.execute(
      async ({ approvalThrottleRepository, employeeRepository, managerApprovalAttemptRepository }) => {
        const codeThrottle = await approvalThrottleRepository.findForUpdate(
          input.tenantId,
          'APPROVER_CODE',
          approverCode
        );
        const registerThrottle = await approvalThrottleRepository.findForUpdate(
          input.tenantId,
          'REGISTER',
          input.registerId
        );
        const now = new Date();

        const appendAttempt = (
          outcome: VerifyManagerApprovalOutputDto['outcome'],
          reason: ManagerApprovalAttemptReason | null,
          employeeId: string | null
        ): Promise<void> =>
          managerApprovalAttemptRepository.append(
            ManagerApprovalAttempt.record({
              id: randomUUID(),
              tenantId: input.tenantId,
              approverCode,
              employeeId,
              registerId: input.registerId,
              saleId: input.saleId,
              outcome,
              reason,
              attemptedAt: now
            })
          );

        const lockReason: ManagerApprovalAttemptReason | null = codeThrottle.isLocked(now)
          ? 'CODE_LOCKED'
          : registerThrottle.isLocked(now)
            ? 'REGISTER_LOCKED'
            : null;

        if (lockReason) {
          await appendAttempt('LOCKED', lockReason, null);

          return { outcome: 'LOCKED', approver: null };
        }

        const employee = await employeeRepository.findByEmployeeCode(input.tenantId, approverCode);
        // An unknown code still derives a key against the hasher's decoy, so the
        // response time does not reveal whether the code exists.
        const pinMatches = await this.credentialHasher.verify(
          input.pin,
          employee?.toPrimitives().pinHash ?? null
        );
        const decision = decideManagerApproval(employee, pinMatches);
        const employeeId = employee?.toPrimitives().id ?? null;

        if (decision.outcome === 'DENIED') {
          codeThrottle.registerFailure(now, this.options.approverCodePolicy);
          registerThrottle.registerFailure(now, this.options.registerPolicy);
          await approvalThrottleRepository.save(codeThrottle);
          await approvalThrottleRepository.save(registerThrottle);
          await appendAttempt('DENIED', decision.reason, employeeId);

          return { outcome: 'DENIED', approver: null };
        }

        codeThrottle.registerSuccess(this.options.approverCodePolicy);
        registerThrottle.registerSuccess(this.options.registerPolicy);
        await approvalThrottleRepository.save(codeThrottle);
        await approvalThrottleRepository.save(registerThrottle);
        await appendAttempt('APPROVED', null, employeeId);

        const approver = decision.approver.toPrimitives();

        return {
          outcome: 'APPROVED',
          approver: {
            employeeId: approver.id,
            employeeCode: approver.employeeCode,
            fullName: approver.fullName
          }
        };
      }
    );
  }
}
