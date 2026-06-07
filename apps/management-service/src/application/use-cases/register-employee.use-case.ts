import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  ConflictError,
  createEmployeeRegisteredEvent,
  type EmployeeRegisteredEventPayload
} from '@supermarket/shared-domain';

import type {
  RegisterEmployeeInputDto,
  RegisterEmployeeOutputDto
} from '../dto/register-employee.dto';
import type { CredentialHasherPort } from '../ports/credential-hasher.port';
import { CREDENTIAL_HASHER } from '../ports/credential-hasher.port';
import type { ManagementTransactionRunnerPort } from '../ports/management-transaction-runner.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '../ports/management-transaction-runner.port';
import type { OutboxEventRelayPort } from '../ports/outbox-event-relay.port';
import { OUTBOX_EVENT_RELAY } from '../ports/outbox-event-relay.port';
import { Employee } from '#/domain/entities/employee.entity';

@Injectable()
export class RegisterEmployeeUseCase {
  constructor(
    @Inject(CREDENTIAL_HASHER)
    private readonly credentialHasher: CredentialHasherPort,
    @Inject(MANAGEMENT_TRANSACTION_RUNNER)
    private readonly transactionRunner: ManagementTransactionRunnerPort,
    @Inject(OUTBOX_EVENT_RELAY)
    private readonly outboxEventRelay: OutboxEventRelayPort
  ) {}

  async execute(input: RegisterEmployeeInputDto): Promise<RegisterEmployeeOutputDto> {
    Employee.assertRawPinMeetsPolicy(input.pin);

    const pinHash = await this.credentialHasher.hash(input.pin);
    const employee = Employee.register({
      id: randomUUID(),
      tenantId: input.tenantId,
      employeeCode: input.employeeCode,
      fullName: input.fullName,
      role: input.role,
      pinHash
    });
    const employeeState = employee.toPrimitives();
    const integrationEvent = createEmployeeRegisteredEvent({
      employeeId: employeeState.id,
      tenantId: employeeState.tenantId,
      employeeCode: employeeState.employeeCode,
      fullName: employeeState.fullName,
      role: employeeState.role,
      active: employeeState.active
    } satisfies EmployeeRegisteredEventPayload);

    await this.transactionRunner.execute(async ({ employeeRepository, outboxEventRepository }) => {
      const existingEmployee = await employeeRepository.findByEmployeeCode(
        employeeState.tenantId,
        employeeState.employeeCode
      );

      if (existingEmployee) {
        throw new ConflictError(
          `Employee code ${employeeState.employeeCode} is already registered for tenant ${employeeState.tenantId}`
        );
      }

      await employeeRepository.save(employee);
      await outboxEventRepository.save(integrationEvent);
    });

    const eventPublicationStatus = await this.outboxEventRelay.dispatch(integrationEvent.eventId);

    return {
      employeeId: employeeState.id,
      tenantId: employeeState.tenantId,
      employeeCode: employeeState.employeeCode,
      fullName: employeeState.fullName,
      role: employeeState.role,
      active: employeeState.active,
      eventPublicationStatus
    };
  }
}
