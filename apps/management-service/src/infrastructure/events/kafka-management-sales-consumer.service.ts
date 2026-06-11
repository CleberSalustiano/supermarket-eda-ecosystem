import { clearTimeout, setTimeout } from 'timers';

import { Inject, Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';

import { Kafka, type Consumer } from 'kafkajs';

import {
  KafkaTopics,
  REGISTER_CLOSED_EVENT_NAME,
  SALE_CANCELED_EVENT_NAME,
  SALE_COMPLETED_EVENT_NAME,
  type EventEnvelope,
  type RegisterClosedEventPayload,
  type SaleCanceledEventPayload,
  type SaleCompletedEventPayload
} from '@supermarket/shared-domain';
import type { ServiceEnvironment } from '@supermarket/shared-infra';
import { AppLoggerService, SERVICE_ENVIRONMENT } from '@supermarket/shared-infra';

import { RegisterClosedConsumer } from '#/interfaces/messaging/register-closed.consumer';
import { SaleCanceledConsumer } from '#/interfaces/messaging/sale-canceled.consumer';
import { SaleCompletedConsumer } from '#/interfaces/messaging/sale-completed.consumer';

@Injectable()
export class KafkaManagementSalesConsumerService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly consumer: Consumer;
  private connectionPromise?: Promise<void>;
  private reconnectTimeout?: NodeJS.Timeout;
  private connected = false;
  private shutdownRequested = false;

  constructor(
    @Inject(SERVICE_ENVIRONMENT)
    private readonly environment: ServiceEnvironment,
    private readonly logger: AppLoggerService,
    private readonly registerClosedConsumer: RegisterClosedConsumer,
    private readonly saleCanceledConsumer: SaleCanceledConsumer,
    private readonly saleCompletedConsumer: SaleCompletedConsumer
  ) {
    const kafka = new Kafka({
      clientId: this.environment.kafka.clientId,
      brokers: this.environment.kafka.brokers
    });

    this.consumer = kafka.consumer({
      groupId: this.environment.kafka.consumerGroupId
    });
  }

  onModuleInit(): void {
    if (this.environment.nodeEnvironment === 'test') {
      return;
    }

    void this.ensureConsumerStarted();
  }

  async onApplicationShutdown(): Promise<void> {
    this.shutdownRequested = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    if (!this.connected) {
      return;
    }

    await this.consumer.disconnect();
    this.connected = false;
    this.logger.log('Management sales Kafka consumer disconnected');
  }

  private async ensureConsumerStarted(): Promise<void> {
    if (this.shutdownRequested || this.connected) {
      return;
    }

    if (!this.connectionPromise) {
      this.connectionPromise = this.startConsumer().finally(() => {
        this.connectionPromise = undefined;
      });
    }

    await this.connectionPromise;
  }

  private async startConsumer(): Promise<void> {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topic: KafkaTopics.checkout.saleCompleted,
        fromBeginning: true
      });
      await this.consumer.subscribe({
        topic: KafkaTopics.checkout.saleCanceled,
        fromBeginning: true
      });
      await this.consumer.subscribe({
        topic: KafkaTopics.checkout.registerClosed,
        fromBeginning: true
      });
      this.connected = true;
      this.logger.log('Management financial Kafka consumer connected');

      await this.consumer.run({
        eachMessage: async ({ message }) => {
          const event = this.parseEventEnvelope(message.value);

          if (!event) {
            return;
          }

          await this.processEvent(event);
        }
      });
    } catch (error: unknown) {
      this.connected = false;
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error while starting the management financial consumer';

      this.logger.error(
        `Failed to start management financial consumer: ${message}`,
        error instanceof Error ? error.stack : undefined
      );

      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.shutdownRequested || this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = undefined;
      void this.ensureConsumerStarted();
    }, 5000);
  }

  private parseEventEnvelope(
    value: Buffer | null
  ):
    | EventEnvelope<SaleCompletedEventPayload>
    | EventEnvelope<SaleCanceledEventPayload>
    | EventEnvelope<RegisterClosedEventPayload>
    | null {
    if (!value) {
      this.logger.warn('Ignoring empty Kafka message while processing management financial events');

      return null;
    }

    try {
      const parsedValue = JSON.parse(value.toString()) as {
        eventName?: unknown;
        payload?: unknown;
      };

      if (
        (parsedValue.eventName !== SALE_COMPLETED_EVENT_NAME &&
          parsedValue.eventName !== SALE_CANCELED_EVENT_NAME &&
          parsedValue.eventName !== REGISTER_CLOSED_EVENT_NAME) ||
        !parsedValue.payload ||
        typeof parsedValue.payload !== 'object' ||
        Array.isArray(parsedValue.payload)
      ) {
        this.logger.warn(
          'Ignoring Kafka message with an unexpected schema for management financial processing'
        );

        return null;
      }

      if (parsedValue.eventName === SALE_COMPLETED_EVENT_NAME) {
        return parsedValue as EventEnvelope<SaleCompletedEventPayload>;
      }

      if (parsedValue.eventName === SALE_CANCELED_EVENT_NAME) {
        return parsedValue as EventEnvelope<SaleCanceledEventPayload>;
      }

      return parsedValue as EventEnvelope<RegisterClosedEventPayload>;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown error while parsing Kafka payload';

      this.logger.error(
        `Failed to parse Kafka management financial message: ${message}`,
        error instanceof Error ? error.stack : undefined
      );

      return null;
    }
  }

  private async processEvent(
    event:
      | EventEnvelope<SaleCompletedEventPayload>
      | EventEnvelope<SaleCanceledEventPayload>
      | EventEnvelope<RegisterClosedEventPayload>
  ): Promise<void> {
    if (this.isSaleCompletedEvent(event)) {
      const result = await this.saleCompletedConsumer.handle(event);

      this.logger.log(
        `Consolidated sale ${result.saleId} for business date ${result.businessDate} with status ${result.processingStatus}`
      );

      return;
    }

    if (this.isSaleCanceledEvent(event)) {
      const result = await this.saleCanceledConsumer.handle(event);

      this.logger.log(
        `Compensated canceled sale ${result.saleId} with status ${result.processingStatus}`
      );

      return;
    }

    const result = await this.registerClosedConsumer.handle(event);

    this.logger.log(
      `Reconciled register session ${result.sessionId} with status ${result.processingStatus}`
    );
  }

  private isSaleCompletedEvent(
    event:
      | EventEnvelope<SaleCompletedEventPayload>
      | EventEnvelope<SaleCanceledEventPayload>
      | EventEnvelope<RegisterClosedEventPayload>
  ): event is EventEnvelope<SaleCompletedEventPayload> {
    return event.eventName === SALE_COMPLETED_EVENT_NAME;
  }

  private isSaleCanceledEvent(
    event:
      | EventEnvelope<SaleCompletedEventPayload>
      | EventEnvelope<SaleCanceledEventPayload>
      | EventEnvelope<RegisterClosedEventPayload>
  ): event is EventEnvelope<SaleCanceledEventPayload> {
    return event.eventName === SALE_CANCELED_EVENT_NAME;
  }
}
