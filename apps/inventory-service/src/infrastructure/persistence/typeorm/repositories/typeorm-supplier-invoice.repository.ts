import type { DataSource, EntityManager } from 'typeorm';

import { SupplierInvoice } from '#/domain/entities/supplier-invoice.entity';
import type { SupplierInvoiceRepositoryPort } from '#/domain/repositories/supplier-invoice.repository';
import { SupplierInvoiceLineTypeormEntity } from '../entities/supplier-invoice-line.typeorm-entity';
import { SupplierInvoiceTypeormEntity } from '../entities/supplier-invoice.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormSupplierInvoiceRepository implements SupplierInvoiceRepositoryPort {
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor | DataSource | EntityManager) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async findBySupplierReference(
    tenantId: string,
    supplierReference: string
  ): Promise<SupplierInvoice | null> {
    const invoiceEntity = await this.repositoryAccessor
      .getRepository(SupplierInvoiceTypeormEntity)
      .findOne({
        where: {
          tenantId,
          supplierReference: supplierReference.trim().toUpperCase()
        }
      });

    if (!invoiceEntity) {
      return null;
    }

    const lineEntities = await this.repositoryAccessor
      .getRepository(SupplierInvoiceLineTypeormEntity)
      .find({
        where: {
          invoiceId: invoiceEntity.id
        },
        order: {
          id: 'ASC'
        }
      });

    return SupplierInvoice.rehydrate({
      id: invoiceEntity.id,
      tenantId: invoiceEntity.tenantId,
      supplierReference: invoiceEntity.supplierReference,
      totalItemsQuantity: invoiceEntity.totalItemsQuantity,
      totalCost: invoiceEntity.totalCost,
      receivedAt: invoiceEntity.receivedAt,
      createdAt: invoiceEntity.createdAt,
      updatedAt: invoiceEntity.updatedAt,
      items: lineEntities.map((lineEntity) => ({
        id: lineEntity.id,
        productId: lineEntity.productId,
        barcode: lineEntity.barcode,
        name: lineEntity.name,
        unitOfMeasure: lineEntity.unitOfMeasure,
        quantity: lineEntity.quantity,
        unitCost: lineEntity.unitCost,
        lineCost: lineEntity.lineCost
      }))
    });
  }

  async save(invoice: SupplierInvoice): Promise<void> {
    const invoiceState = invoice.toPrimitives();

    await this.repositoryAccessor.getRepository(SupplierInvoiceTypeormEntity).save({
      id: invoiceState.id,
      tenantId: invoiceState.tenantId,
      supplierReference: invoiceState.supplierReference,
      totalItemsQuantity: invoiceState.totalItemsQuantity,
      totalCost: invoiceState.totalCost,
      receivedAt: new Date(invoiceState.receivedAt),
      createdAt: new Date(invoiceState.createdAt),
      updatedAt: new Date(invoiceState.updatedAt)
    });

    await this.repositoryAccessor.getRepository(SupplierInvoiceLineTypeormEntity).save(
      invoiceState.items.map((line) => ({
        id: line.id,
        invoiceId: invoiceState.id,
        productId: line.productId,
        barcode: line.barcode,
        name: line.name,
        unitOfMeasure: line.unitOfMeasure,
        quantity: line.quantity,
        unitCost: line.unitCost,
        lineCost: line.lineCost
      }))
    );
  }
}
