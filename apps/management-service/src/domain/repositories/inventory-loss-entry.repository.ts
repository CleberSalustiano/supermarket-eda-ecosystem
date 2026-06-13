import type { InventoryLossEntry } from '#/domain/entities/inventory-loss-entry.entity';

export interface InventoryLossEntryBusinessDateSummary {
  businessDate: string;
  lossAmountTotal: number;
  lossItemsQuantity: number;
  lossEventsCount: number;
}

export interface InventoryLossEntryRepositoryPort {
  saveIfAbsent(entry: InventoryLossEntry): Promise<boolean>;
  summarizeByBusinessDateRange(
    tenantId: string,
    fromDate: string,
    toDate: string
  ): Promise<InventoryLossEntryBusinessDateSummary[]>;
}
