import type { EventEnvelope, RegisterClosedEventPayload } from '@supermarket/shared-domain';
import type { CashReconciliationStatus } from '#/domain/entities/cash-reconciliation.entity';

export interface ReconcileRegisterClosureInputDto {
  event: EventEnvelope<RegisterClosedEventPayload>;
}

export interface ReconcileRegisterClosureOutputDto {
  sessionId: string;
  tenantId: string;
  businessDate: string;
  processingStatus: 'processed' | 'ignored' | 'skipped';
  cashReconciliationId: string | null;
  expectedCashAmount: number | null;
  differenceAmount: number | null;
  reconciliationStatus: CashReconciliationStatus | null;
}
