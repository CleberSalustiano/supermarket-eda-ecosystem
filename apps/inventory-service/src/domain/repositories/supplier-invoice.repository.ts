import type { SupplierInvoice } from '#/domain/entities/supplier-invoice.entity';

export interface SupplierInvoiceRepositoryPort {
  findBySupplierReference(tenantId: string, supplierReference: string): Promise<SupplierInvoice | null>;
  save(invoice: SupplierInvoice): Promise<void>;
}
