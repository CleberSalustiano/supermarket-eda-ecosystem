import { resolveCorrelationId } from '../../../../src/http/interceptors/correlation-id.interceptor';

describe('resolveCorrelationId', () => {
  it('reuses an incoming correlation id', () => {
    expect(resolveCorrelationId('request-123')).toBe('request-123');
  });

  it('generates a correlation id when the header is missing', () => {
    expect(resolveCorrelationId(undefined)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
