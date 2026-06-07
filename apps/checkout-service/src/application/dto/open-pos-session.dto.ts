import type { PosSession, PosSessionStatus } from '#/domain/entities/pos-session.entity';

export interface OpenPosSessionInputDto {
  tenantId: string;
  registerId: string;
  operatorId: string;
  openingFloatAmount: number;
}

export interface OpenPosSessionOutputDto {
  sessionId: string;
  tenantId: string;
  registerId: string;
  operatorId: string;
  openingFloatAmount: number;
  status: PosSessionStatus;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toOpenPosSessionOutputDto(session: PosSession): OpenPosSessionOutputDto {
  const sessionState = session.toPrimitives();

  return {
    sessionId: sessionState.id,
    tenantId: sessionState.tenantId,
    registerId: sessionState.registerId,
    operatorId: sessionState.operatorId,
    openingFloatAmount: sessionState.openingFloatAmount,
    status: sessionState.status,
    openedAt: sessionState.openedAt,
    closedAt: sessionState.closedAt,
    createdAt: sessionState.createdAt,
    updatedAt: sessionState.updatedAt
  };
}
