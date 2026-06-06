import type { TenantScoped } from '../identifiers/tenant-scoped.interface';
import { createEventEnvelope, type EventEnvelope } from './event-envelope';
import { KafkaTopics } from './kafka-topics';
import type { EmployeeRole } from '../enums/employee-role.enum';

export const EMPLOYEE_REGISTERED_EVENT_NAME = 'EmployeeRegistered';

export interface EmployeeRegisteredEventPayload extends TenantScoped {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  role: EmployeeRole;
  active: boolean;
}

export function createEmployeeRegisteredEvent(
  payload: EmployeeRegisteredEventPayload
): EventEnvelope<EmployeeRegisteredEventPayload> {
  return createEventEnvelope({
    eventName: EMPLOYEE_REGISTERED_EVENT_NAME,
    topic: KafkaTopics.management.employeeRegistered,
    aggregateId: payload.employeeId,
    payload
  });
}
