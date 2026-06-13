import type { LowStockAlertOptions } from '#/application/ports/low-stock-alert.options';

export function createLowStockAlertOptions(
  source: NodeJS.ProcessEnv = process.env
): LowStockAlertOptions {
  return {
    intervalMs: parsePositiveInteger(source['LOW_STOCK_ALERT_INTERVAL_MS'], 300000, 'LOW_STOCK_ALERT_INTERVAL_MS'),
    cooldownMinutes: parsePositiveInteger(
      source['LOW_STOCK_ALERT_COOLDOWN_MINUTES'],
      60,
      'LOW_STOCK_ALERT_COOLDOWN_MINUTES'
    ),
    maxItemsPerBatch: parsePositiveInteger(
      source['LOW_STOCK_ALERT_MAX_ITEMS_PER_BATCH'],
      100,
      'LOW_STOCK_ALERT_MAX_ITEMS_PER_BATCH'
    )
  };
}

function parsePositiveInteger(
  rawValue: string | undefined,
  fallbackValue: number,
  label: string
): number {
  if (rawValue === undefined || rawValue.trim() === '') {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsedValue;
}
