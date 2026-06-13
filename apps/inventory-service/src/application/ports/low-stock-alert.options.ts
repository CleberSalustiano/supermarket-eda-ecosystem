export interface LowStockAlertOptions {
  intervalMs: number;
  cooldownMinutes: number;
  maxItemsPerBatch: number;
}

export const LOW_STOCK_ALERT_OPTIONS = Symbol('LOW_STOCK_ALERT_OPTIONS');
