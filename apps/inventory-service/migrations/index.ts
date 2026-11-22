import { CreateInventoryStockTables1762992000000 } from './1762992000000-CreateInventoryStockTables';
import { AddProcessedEventsAggregateLookupIndex1763683200000 } from './1763683200000-AddProcessedEventsAggregateLookupIndex';
import { AddInventoryLossAndOutboxTables1763856000000 } from './1763856000000-AddInventoryLossAndOutboxTables';
import { AddSupplierInvoicesAndAverageCost1764028800000 } from './1764028800000-AddSupplierInvoicesAndAverageCost';
import { AddPhysicalAdjustmentsAndLowStockState1764115200000 } from './1764115200000-AddPhysicalAdjustmentsAndLowStockState';

export const inventoryServiceMigrations = [
  CreateInventoryStockTables1762992000000,
  AddProcessedEventsAggregateLookupIndex1763683200000,
  AddInventoryLossAndOutboxTables1763856000000,
  AddSupplierInvoicesAndAverageCost1764028800000,
  AddPhysicalAdjustmentsAndLowStockState1764115200000
] as const;
