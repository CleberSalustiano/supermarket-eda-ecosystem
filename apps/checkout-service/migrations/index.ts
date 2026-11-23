import { CreateCheckoutProductCatalogTable1762387200000 } from './1762387200000-CreateCheckoutProductCatalogTable';
import { CreateCheckoutSessionAndSaleTables1762732800000 } from './1762732800000-CreateCheckoutSessionAndSaleTables';
import { AddCheckoutSaleCompletionAndOutbox1762905600000 } from './1762905600000-AddCheckoutSaleCompletionAndOutbox';
import { AddCheckoutCancellationAndRegisterClose1763596800000 } from './1763596800000-AddCheckoutCancellationAndRegisterClose';
import { AddSaleCancellationApprover1764374400000 } from './1764374400000-AddSaleCancellationApprover';

export const checkoutServiceMigrations = [
  CreateCheckoutProductCatalogTable1762387200000,
  CreateCheckoutSessionAndSaleTables1762732800000,
  AddCheckoutSaleCompletionAndOutbox1762905600000,
  AddCheckoutCancellationAndRegisterClose1763596800000,
  AddSaleCancellationApprover1764374400000
] as const;
