import { ConflictError, DomainValidationError } from '@supermarket/shared-domain';

import { PosSession } from '#/domain/entities/pos-session.entity';

describe('PosSession', () => {
  it('opens a valid session with normalized values', () => {
    const session = PosSession.open({
      id: 'aa2f8448-c17b-4e13-bcc8-a210274df97a',
      tenantId: 'b4a36763-7060-43a5-ab6d-9184585d5c48',
      registerId: ' register-01 ',
      operatorId: '5da5d613-d196-4895-943e-118f42c6ad6f',
      openingFloatAmount: 150.5,
      openedAt: new Date('2026-06-07T10:00:00.000Z')
    });

    expect(session.toPrimitives()).toMatchObject({
      id: 'aa2f8448-c17b-4e13-bcc8-a210274df97a',
      tenantId: 'b4a36763-7060-43a5-ab6d-9184585d5c48',
      registerId: 'register-01',
      operatorId: '5da5d613-d196-4895-943e-118f42c6ad6f',
      openingFloatAmount: 150.5,
      status: 'OPEN',
      openedAt: '2026-06-07T10:00:00.000Z',
      closedAt: null
    });
  });

  it('rejects a closed session without a close timestamp during rehydration', () => {
    expect(() =>
      PosSession.rehydrate({
        id: 'aa2f8448-c17b-4e13-bcc8-a210274df97a',
        tenantId: 'b4a36763-7060-43a5-ab6d-9184585d5c48',
        registerId: 'register-01',
        operatorId: '5da5d613-d196-4895-943e-118f42c6ad6f',
        openingFloatAmount: 150.5,
        status: 'CLOSED',
        openedAt: new Date('2026-06-07T10:00:00.000Z'),
        closedAt: null,
        createdAt: new Date('2026-06-07T10:00:00.000Z'),
        updatedAt: new Date('2026-06-07T11:00:00.000Z')
      })
    ).toThrow(DomainValidationError);
  });

  it('blocks operations when the session is not open', () => {
    const session = PosSession.rehydrate({
      id: 'aa2f8448-c17b-4e13-bcc8-a210274df97a',
      tenantId: 'b4a36763-7060-43a5-ab6d-9184585d5c48',
      registerId: 'register-01',
      operatorId: '5da5d613-d196-4895-943e-118f42c6ad6f',
      openingFloatAmount: 150.5,
      status: 'CLOSED',
      openedAt: new Date('2026-06-07T10:00:00.000Z'),
      closedAt: new Date('2026-06-07T18:00:00.000Z'),
      createdAt: new Date('2026-06-07T10:00:00.000Z'),
      updatedAt: new Date('2026-06-07T18:00:00.000Z')
    });

    expect(() => session.assertOpen()).toThrow(ConflictError);
  });
});
