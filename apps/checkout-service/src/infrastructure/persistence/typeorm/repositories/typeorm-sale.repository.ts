import type { DataSource, EntityManager } from 'typeorm';
import { In } from 'typeorm';

import { SalePaymentMethod } from '@supermarket/shared-domain';

import type { SaleRepositoryPort } from '#/domain/repositories/sale.repository';
import { Sale } from '#/domain/entities/sale.entity';
import type { ManagerApprovalPrimitives } from '#/domain/value-objects/manager-approval';
import { SaleItemTypeormEntity } from '../entities/sale-item.typeorm-entity';
import { SaleTypeormEntity } from '../entities/sale.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormSaleRepository implements SaleRepositoryPort {
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor | DataSource | EntityManager) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async findById(tenantId: string, saleId: string): Promise<Sale | null> {
    const entity = await this.repositoryAccessor.getRepository(SaleTypeormEntity).findOne({
      where: {
        id: saleId,
        tenantId
      }
    });

    return entity ? toDomain(entity) : null;
  }

  async findByIdForUpdate(tenantId: string, saleId: string): Promise<Sale | null> {
    // Lock only the sale row: FOR UPDATE cannot target the outer join that the
    // eager items relation adds. The items are then read under the same lock.
    const lockedSale = await this.repositoryAccessor
      .getRepository(SaleTypeormEntity)
      .createQueryBuilder('sale')
      .select('sale.id', 'id')
      .where({ id: saleId, tenantId })
      .setLock('pessimistic_write')
      .getRawOne<{ id: string }>();

    if (!lockedSale) {
      return null;
    }

    return this.findById(tenantId, saleId);
  }

  async hasNonTerminalBySessionId(tenantId: string, sessionId: string): Promise<boolean> {
    const matchingSalesCount = await this.repositoryAccessor
      .getRepository(SaleTypeormEntity)
      .count({
        where: {
          tenantId,
          sessionId,
          status: In(['OPEN', 'PAID'])
        }
      });

    return matchingSalesCount > 0;
  }

  async save(sale: Sale): Promise<void> {
    const saleState = sale.toPrimitives();
    const saleRepository = this.repositoryAccessor.getRepository(SaleTypeormEntity);
    const saleItemRepository = this.repositoryAccessor.getRepository(SaleItemTypeormEntity);

    await saleRepository.save({
      id: saleState.id,
      tenantId: saleState.tenantId,
      sessionId: saleState.sessionId,
      status: saleState.status,
      paymentMethod: saleState.paymentMethod,
      paidAmount: saleState.paidAmount,
      changeAmount: saleState.changeAmount,
      paidAt: saleState.paidAt ? new Date(saleState.paidAt) : null,
      completedAt: saleState.completedAt ? new Date(saleState.completedAt) : null,
      canceledAt: saleState.canceledAt ? new Date(saleState.canceledAt) : null,
      cancellationReason: saleState.cancellationReason,
      cancellationApprovedByEmployeeId: saleState.cancellationApproval?.employeeId ?? null,
      cancellationApprovedByEmployeeCode: saleState.cancellationApproval?.employeeCode ?? null,
      cancellationApprovedByFullName: saleState.cancellationApproval?.fullName ?? null,
      totalItemsQuantity: saleState.totalItemsQuantity,
      subtotal: saleState.subtotal,
      total: saleState.total,
      createdAt: new Date(saleState.createdAt),
      updatedAt: new Date(saleState.updatedAt)
    });

    await saleItemRepository.delete({
      saleId: saleState.id
    });

    if (saleState.items.length === 0) {
      return;
    }

    await saleItemRepository.save(
      saleState.items.map((item) => ({
        saleId: saleState.id,
        productId: item.productId,
        barcode: item.barcode,
        name: item.name,
        unitOfMeasure: item.unitOfMeasure,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal
      }))
    );
  }
}

function toDomain(entity: SaleTypeormEntity): Sale {
  return Sale.rehydrate({
    id: entity.id,
    tenantId: entity.tenantId,
    sessionId: entity.sessionId,
    status: entity.status as 'OPEN' | 'PAID' | 'COMPLETED' | 'CANCELED',
    paymentMethod: entity.paymentMethod as SalePaymentMethod | null,
    paidAmount: entity.paidAmount,
    changeAmount: entity.changeAmount,
    paidAt: entity.paidAt,
    completedAt: entity.completedAt,
    canceledAt: entity.canceledAt,
    cancellationReason: entity.cancellationReason,
    cancellationApproval: toCancellationApproval(entity),
    totalItemsQuantity: entity.totalItemsQuantity,
    subtotal: entity.subtotal,
    total: entity.total,
    items: entity.items.map((item) => ({
      productId: item.productId,
      barcode: item.barcode,
      name: item.name,
      unitOfMeasure: item.unitOfMeasure,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal
    })),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  });
}

function toCancellationApproval(entity: SaleTypeormEntity): ManagerApprovalPrimitives | null {
  if (
    entity.cancellationApprovedByEmployeeId === null &&
    entity.cancellationApprovedByEmployeeCode === null &&
    entity.cancellationApprovedByFullName === null
  ) {
    return null;
  }

  return {
    employeeId: entity.cancellationApprovedByEmployeeId ?? '',
    employeeCode: entity.cancellationApprovedByEmployeeCode ?? '',
    fullName: entity.cancellationApprovedByFullName ?? ''
  };
}
