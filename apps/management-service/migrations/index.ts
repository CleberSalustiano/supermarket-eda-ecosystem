import { CreateManagementCatalogTables1762214400000 } from './1762214400000-CreateManagementCatalogTables';
import { CreateManagementFinancialTables1763251200000 } from './1763251200000-CreateManagementFinancialTables';
import { AddManagementCashReconciliationTables1763769600000 } from './1763769600000-AddManagementCashReconciliationTables';
import { CreateManagementInventoryLossEntriesTable1763942400000 } from './1763942400000-CreateManagementInventoryLossEntriesTable';
import { NormalizeInventoryLossEntriesCreatedAtDefault1764201600000 } from './1764201600000-NormalizeInventoryLossEntriesCreatedAtDefault';

export const managementServiceMigrations = [
  CreateManagementCatalogTables1762214400000,
  CreateManagementFinancialTables1763251200000,
  AddManagementCashReconciliationTables1763769600000,
  CreateManagementInventoryLossEntriesTable1763942400000,
  NormalizeInventoryLossEntriesCreatedAtDefault1764201600000
] as const;
