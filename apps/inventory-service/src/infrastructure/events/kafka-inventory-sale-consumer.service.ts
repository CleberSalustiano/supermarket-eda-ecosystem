import { clearTimeout, setTimeout } from 'timers';

import { Inject, Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';

import { Kafka, type Consumer } from 'kafkajs';

import {
  KafkaTopics,
  SALE_CANCELED_EVENT_NAME,
  SALE_COMPLETED_EVENT_NAME,
  type EventEnvelope,
  type SaleCanceledEventPayload,
  type SaleCompletedEventPayload
} from '@supermarket/shared-domain';
import type { ServiceEnvironment } from '@supermarket/shared-infra';
import { AppLoggerService, SERVICE_ENVIRONMENT } from '@supermarket/shared-infra';

import { SaleCanceledConsumer } from '#/interfaces/messaging/sale-canceled.consumer';
import { SaleCompletedConsumer } from '#/interfaces/messaging/sale-completed.consumer';

@Injectable()
export class KafkaInventorySaleConsumerService implements OnModuleInit, OnApplicationShutdown {
  private readonly consumer: Consumer;
  private connectionPromise?: Promise<void>;
  private reconnectTimeout?: NodeJS.Timeout;
  private connected = false;
  private shutdownRequested = false;

  constructor(
    @Inject(SERVICE_ENVIRONMENT)
    private readonly environment: ServiceEnvironment,
    private readonly logger: AppLoggerService,
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
    this.logger.log('Inventory sale Kafka consumer disconnected');
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
      this.connected = true;
      this.logger.log('Inventory sales Kafka consumer connected');

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
          : 'Unknown error while starting the inventory sales consumer';

      this.logger.error(
        `Failed to start inventory sales consumer: ${message}`,
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
  ): EventEnvelope<SaleCompletedEventPayload> | EventEnvelope<SaleCanceledEventPayload> | null {
    if (!value) {
      this.logger.warn('Ignoring empty Kafka message while processing inventory sales');

      return null;
    }

    try {
      const parsedValue = JSON.parse(value.toString()) as {
        eventName?: unknown;
        payload?: unknown;
      };

      if (
        (parsedValue.eventName !== SALE_COMPLETED_EVENT_NAME &&
          parsedValue.eventName !== SALE_CANCELED_EVENT_NAME) ||
        !parsedValue.payload ||
        typeof parsedValue.payload !== 'object' ||
        Array.isArray(parsedValue.payload)
      ) {
        this.logger.warn('Ignoring Kafka message with an unexpected schema for inventory sales');

        return null;
      }

      if (parsedValue.eventName === SALE_COMPLETED_EVENT_NAME) {
        return parsedValue as EventEnvelope<SaleCompletedEventPayload>;
      }

      return parsedValue as EventEnvelope<SaleCanceledEventPayload>;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown error while parsing Kafka payload';

      this.logger.error(
        `Failed to parse Kafka inventory sales message: ${message}`,
        error instanceof Error ? error.stack : undefined
      );

      return null;
    }
  }

  private async processEvent(
    event: EventEnvelope<SaleCompletedEventPayload> | EventEnvelope<SaleCanceledEventPayload>
  ): Promise<void> {
    if (this.isSaleCompletedEvent(event)) {
      const result = await this.saleCompletedConsumer.handle(event);

      this.logger.log(
        `Processed sale issue for sale ${result.saleId} with status ${result.processingStatus}`
      );

      return;
    }

    const result = await this.saleCanceledConsumer.handle(event);

    this.logger.log(
      `Processed sale issue reversion for sale ${result.saleId} with status ${result.processingStatus}`
    );
  }

  private isSaleCompletedEvent(
    event: EventEnvelope<SaleCompletedEventPayload> | EventEnvelope<SaleCanceledEventPayload>
  ): event is EventEnvelope<SaleCompletedEventPayload> {
    return event.eventName === SALE_COMPLETED_EVENT_NAME;
  }
}
