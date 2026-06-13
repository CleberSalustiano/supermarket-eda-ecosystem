import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  ConflictError,
  createProductReceivedEvent,
  DomainValidationError
} from '@supermarket/shared-domain';

import type {
  RegisterSupplierInvoiceInputDto,
  RegisterSupplierInvoiceOutputDto
} from '../dto/register-supplier-invoice.dto';
import type { OutboxEventRelayPort } from '../ports/outbox-event-relay.port';
import { OUTBOX_EVENT_RELAY } from '../ports/outbox-event-relay.port';
import {
  INVENTORY_TRANSACTION_RUNNER,
  type InventoryTransactionRunnerPort
} from '../ports/inventory-transaction-runner.port';
import { InventoryItem } from '#/domain/entities/inventory-item.entity';
import { StockMovement } from '#/domain/entities/stock-movement.entity';
import { SupplierInvoice } from '#/domain/entities/supplier-invoice.entity';

@Injectable()
export class RegisterSupplierInvoiceUseCase {
  constructor(
    @Inject(INVENTORY_TRANSACTION_RUNNER)
    private readonly transactionRunner: InventoryTransactionRunnerPort,
    @Inject(OUTBOX_EVENT_RELAY)
    private readonly outboxEventRelay: OutboxEventRelayPort
  ) {}

  async execute(
    input: RegisterSupplierInvoiceInputDto
  ): Promise<RegisterSupplierInvoiceOutputDto> {
    const receivedAt = ensureDateFromOptionalIsoString(input.receivedAt);
    const invoice = SupplierInvoice.register({
      id: randomUUID(),
      tenantId: input.tenantId,
      supplierReference: input.supplierReference,
      receivedAt,
      items: input.items.map((item) => ({
        id: randomUUID(),
        productId: item.productId,
        barcode: item.barcode,
        name: item.name,
        unitOfMeasure: item.unitOfMeasure,
        quantity: item.quantity,
        unitCost: item.unitCost
      }))
    });
    const invoiceState = invoice.toPrimitives();

    const result = await this.transactionRunner.execute(
      async ({
        inventoryItemRepository,
        outboxEventRepository,
        stockMovementRepository,
        supplierInvoiceRepository
      }) => {
        const existingInvoice = await supplierInvoiceRepository.findBySupplierReference(
          invoiceState.tenantId,
          invoiceState.supplierReference
        );

        if (existingInvoice) {
          throw new ConflictError(
            `Supplier invoice ${invoiceState.supplierReference} already exists for tenant ${invoiceState.tenantId}`
          );
        }

        const receiptItems: RegisterSupplierInvoiceOutputDto['items'] = [];

        for (const line of invoiceState.items) {
          const inventoryItem =
            (await inventoryItemRepository.findByProductId(invoiceState.tenantId, line.productId)) ??
            InventoryItem.initialize({
              productId: line.productId,
              tenantId: invoiceState.tenantId,
              barcode: line.barcode,
              name: line.name,
              unitOfMeasure: line.unitOfMeasure
            });

          inventoryItem.receiveStock({
            barcode: line.barcode,
            name: line.name,
            unitOfMeasure: line.unitOfMeasure,
            quantity: line.quantity,
            unitCost: line.unitCost,
            updatedAt: receivedAt
          });

          const itemState = inventoryItem.toPrimitives();

          if (itemState.averageUnitCost === null) {
            throw new Error(
              `Inventory item ${itemState.productId} did not persist an average unit cost after receipt`
            );
          }

          await inventoryItemRepository.save(inventoryItem);

          receiptItems.push({
            productId: line.productId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            lineCost: line.lineCost,
            onHandQuantity: itemState.onHandQuantity,
            averageUnitCost: itemState.averageUnitCost,
            stockMovementId: randomUUID()
          });
        }

        const event = createProductReceivedEvent({
          invoiceId: invoiceState.id,
          tenantId: invoiceState.tenantId,
          supplierReference: invoiceState.supplierReference,
          receivedAt: invoiceState.receivedAt,
          totalItemsQuantity: invoiceState.totalItemsQuantity,
          totalCost: invoiceState.totalCost,
          items: invoiceState.items.map((line) => {
            const receiptItem = receiptItems.find((item) => item.productId === line.productId);

            if (!receiptItem) {
              throw new Error(
                `Receipt event item for product ${line.productId} was not assembled during invoice registration`
              );
            }

            return {
              productId: line.productId,
              barcode: line.barcode,
              name: line.name,
              unitOfMeasure: line.unitOfMeasure,
              quantity: line.quantity,
              unitCost: line.unitCost,
              lineCost: line.lineCost,
              onHandQuantityAfterReceipt: receiptItem.onHandQuantity,
              averageUnitCostAfterReceipt: receiptItem.averageUnitCost
            };
          })
        });

        for (const line of invoiceState.items) {
          const receiptItem = receiptItems.find((item) => item.productId === line.productId);

          if (!receiptItem) {
            throw new Error(`Receipt stock movement for product ${line.productId} was not assembled`);
          }

          await stockMovementRepository.save(
            StockMovement.recordReceipt({
              id: receiptItem.stockMovementId,
              tenantId: invoiceState.tenantId,
              productId: line.productId,
              quantity: line.quantity,
              referenceId: invoiceState.id,
              referenceEventId: event.eventId,
              supplierReference: invoiceState.supplierReference,
              occurredAt: receivedAt
            })
          );
        }

        await supplierInvoiceRepository.save(invoice);
        await outboxEventRepository.save(event);

        return {
          invoiceId: invoiceState.id,
          tenantId: invoiceState.tenantId,
          supplierReference: invoiceState.supplierReference,
          receivedAt: invoiceState.receivedAt,
          totalItemsQuantity: invoiceState.totalItemsQuantity,
          totalCost: invoiceState.totalCost,
          items: receiptItems,
          eventId: event.eventId
        };
      }
    );

    const eventPublicationStatus = await this.outboxEventRelay.dispatch(result.eventId);

    return {
      invoiceId: result.invoiceId,
      tenantId: result.tenantId,
      supplierReference: result.supplierReference,
      receivedAt: result.receivedAt,
      totalItemsQuantity: result.totalItemsQuantity,
      totalCost: result.totalCost,
      items: result.items,
      eventPublicationStatus
    };
  }
}

function ensureDateFromOptionalIsoString(value: string | undefined): Date {
  if (value === undefined) {
    return new Date();
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new DomainValidationError('Received at cannot be empty');
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new DomainValidationError('Received at is invalid');
  }

  return parsedDate;
}
