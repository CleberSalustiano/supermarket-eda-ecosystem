import type { EmployeeRole } from '@supermarket/shared-domain';

import type { IntegrationEventPublicationStatus } from './integration-event-publication-status';

export interface RegisterEmployeeInputDto {
  tenantId: string;
  employeeCode: string;
  fullName: string;
  role: EmployeeRole;
  pin: string;
}

export interface RegisterEmployeeOutputDto {
  employeeId: string;
  tenantId: string;
  employeeCode: string;
  fullName: string;
  role: EmployeeRole;
  active: boolean;
  eventPublicationStatus: IntegrationEventPublicationStatus;
}
