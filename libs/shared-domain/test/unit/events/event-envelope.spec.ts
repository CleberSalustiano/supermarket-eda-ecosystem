import { createEventEnvelope } from '#/events/event-envelope';

describe('createEventEnvelope', () => {
  it('creates an envelope with generated metadata', () => {
    const envelope = createEventEnvelope({
      eventName: 'ProductPriceUpdated',
      topic: 'management.product-price-updated',
      aggregateId: 'product-123',
      payload: {
        tenantId: 'tenant-123',
        unitPrice: 19.9
      }
    });

    expect(envelope.eventId).toBeDefined();
    expect(envelope.tenantId).toBe('tenant-123');
    expect(envelope.occurredAt).toEqual(expect.any(String));
    expect(envelope.payload.unitPrice).toBe(19.9);
  });
});
