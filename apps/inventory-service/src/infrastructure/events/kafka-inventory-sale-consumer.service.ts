import { clearTimeout, setTimeout } from 'timers';

import { Inject, Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';

import { Kafka, type Consumer } from 'kafkajs';

import {
  KafkaTopics,
  SALE_COMPLETED_EVENT_NAME,
  type EventEnvelope,
  type SaleCompletedEventPayload
} from '@supermarket/shared-domain';
import type { ServiceEnvironment } from '@supermarket/shared-infra';
import { AppLoggerService, SERVICE_ENVIRONMENT } from '@supermarket/shared-infra';

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
      this.connected = true;
      this.logger.log('Inventory sale Kafka consumer connected');

      await this.consumer.run({
        eachMessage: async ({ message }) => {
          const event = this.parseSaleCompletedEvent(message.value);

          if (!event) {
            return;
          }

          const result = await this.saleCompletedConsumer.handle(event);

          this.logger.log(
            `Processed sale issue for sale ${result.saleId} with status ${result.processingStatus}`
          );
        }
      });
    } catch (error: unknown) {
      this.connected = false;
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error while starting the inventory sale consumer';

      this.logger.error(
        `Failed to start inventory sale consumer: ${message}`,
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

  private parseSaleCompletedEvent(
    value: Buffer | null
  ): EventEnvelope<SaleCompletedEventPayload> | null {
    if (!value) {
      this.logger.warn('Ignoring empty Kafka message while processing inventory sale issues');

      return null;
    }

    try {
      const parsedValue = JSON.parse(value.toString()) as Partial<
        EventEnvelope<SaleCompletedEventPayload>
      >;

      if (
        parsedValue.eventName !== SALE_COMPLETED_EVENT_NAME ||
        !parsedValue.payload ||
        typeof parsedValue.payload !== 'object' ||
        Array.isArray(parsedValue.payload)
      ) {
        this.logger.warn(
          'Ignoring Kafka message with an unexpected schema for inventory sale issue processing'
        );

        return null;
      }

      return parsedValue as EventEnvelope<SaleCompletedEventPayload>;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown error while parsing Kafka payload';

      this.logger.error(
        `Failed to parse Kafka inventory sale message: ${message}`,
        error instanceof Error ? error.stack : undefined
      );

      return null;
    }
  }
}
