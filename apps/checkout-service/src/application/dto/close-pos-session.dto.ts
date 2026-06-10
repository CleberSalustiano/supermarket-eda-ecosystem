import type { IntegrationEventPublicationStatus } from './integration-event-publication-status';
import type { PosSession, PosSessionStatus } from '#/domain/entities/pos-session.entity';

export interface ClosePosSessionInputDto {
  tenantId: string;
  sessionId: string;
  declaredCashAmount: number;
}

export interface ClosePosSessionOutputDto {
  sessionId: string;
  tenantId: string;
  registerId: string;
  operatorId: string;
  openingFloatAmount: number;
  declaredCashAmount: number;
  status: PosSessionStatus;
  openedAt: string;
  closedAt: string;
  createdAt: string;
  updatedAt: string;
  eventPublicationStatus: IntegrationEventPublicationStatus;
}

export function toClosePosSessionOutputDto(
  session: PosSession,
  eventPublicationStatus: IntegrationEventPublicationStatus
): ClosePosSessionOutputDto {
  const sessionState = session.toPrimitives();

  return {
    sessionId: sessionState.id,
    tenantId: sessionState.tenantId,
    registerId: sessionState.registerId,
    operatorId: sessionState.operatorId,
    openingFloatAmount: sessionState.openingFloatAmount,
    declaredCashAmount: sessionState.declaredCashAmount!,
    status: sessionState.status,
    openedAt: sessionState.openedAt,
    closedAt: sessionState.closedAt!,
    createdAt: sessionState.createdAt,
    updatedAt: sessionState.updatedAt,
    eventPublicationStatus
  };
}
