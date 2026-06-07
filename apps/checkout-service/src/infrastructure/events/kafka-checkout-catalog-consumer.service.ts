import { clearTimeout, setTimeout } from 'timers';

import { Inject, Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';

import { Kafka, type Consumer } from 'kafkajs';

import {
  KafkaTopics,
  PRODUCT_PRICE_UPDATED_EVENT_NAME,
  type EventEnvelope,
  type ProductPriceUpdatedEventPayload
} from '@supermarket/shared-domain';
import type { ServiceEnvironment } from '@supermarket/shared-infra';
import { AppLoggerService, SERVICE_ENVIRONMENT } from '@supermarket/shared-infra';

import { ProductPriceUpdatedConsumer } from '../../interfaces/messaging/product-price-updated.consumer';

@Injectable()
export class KafkaCheckoutCatalogConsumerService implements OnModuleInit, OnApplicationShutdown {
  private readonly consumer: Consumer;
  private connectionPromise?: Promise<void>;
  private reconnectTimeout?: NodeJS.Timeout;
  private connected = false;
  private shutdownRequested = false;

  constructor(
    @Inject(SERVICE_ENVIRONMENT)
    private readonly environment: ServiceEnvironment,
    private readonly logger: AppLoggerService,
    private readonly productPriceUpdatedConsumer: ProductPriceUpdatedConsumer
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

    if (this.reconnectTimeout !== undefined) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    if (!this.connected) {
      return;
    }

    await this.consumer.disconnect();
    this.connected = false;
    this.logger.log('Checkout product catalog Kafka consumer disconnected');
  }

  private async ensureConsumerStarted(): Promise<void> {
    if (this.shutdownRequested || this.connected) {
      return;
    }

    if (this.connectionPromise === undefined) {
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
        topic: KafkaTopics.management.productPriceUpdated,
        fromBeginning: true
      });
      this.connected = true;
      this.logger.log('Checkout product catalog Kafka consumer connected');

      await this.consumer.run({
        eachMessage: async ({ message }) => {
          const event = this.parseProductPriceUpdatedEvent(message.value);

          if (event === null) {
            return;
          }

          const result = await this.productPriceUpdatedConsumer.handle(event);

          this.logger.log(
            `Synchronized product ${result.productId} for tenant ${result.tenantId} with status ${result.synchronizationStatus}`
          );
        }
      });
    } catch (error: unknown) {
      this.connected = false;
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error while starting the checkout product catalog consumer';

      this.logger.error(
        `Failed to start checkout product catalog consumer: ${message}`,
        error instanceof Error ? error.stack : undefined
      );

      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.shutdownRequested || this.reconnectTimeout !== undefined) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = undefined;
      void this.ensureConsumerStarted();
    }, 5000);
  }

  private parseProductPriceUpdatedEvent(
    value: Buffer | null
  ): EventEnvelope<ProductPriceUpdatedEventPayload> | null {
    if (value === null) {
      this.logger.warn('Ignoring empty Kafka message while synchronizing the checkout product cache');

      return null;
    }

    try {
      const parsedValue = JSON.parse(value.toString()) as Partial<
        EventEnvelope<ProductPriceUpdatedEventPayload>
      >;

      if (
        parsedValue.eventName !== PRODUCT_PRICE_UPDATED_EVENT_NAME ||
        parsedValue.payload === undefined ||
        typeof parsedValue.payload !== 'object' ||
        parsedValue.payload === null
      ) {
        this.logger.warn(
          'Ignoring Kafka message with an unexpected schema for product catalog synchronization'
        );

        return null;
      }

      return parsedValue as EventEnvelope<ProductPriceUpdatedEventPayload>;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown error while parsing Kafka payload';

      this.logger.error(
        `Failed to parse Kafka product catalog message: ${message}`,
        error instanceof Error ? error.stack : undefined
      );

      return null;
    }
  }
}
