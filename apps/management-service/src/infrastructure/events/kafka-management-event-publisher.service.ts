import { Injectable, Inject, OnApplicationShutdown } from '@nestjs/common';

import { Kafka, Producer } from 'kafkajs';

import type { EventEnvelope, EventPayload } from '@supermarket/shared-domain';
import type { ServiceEnvironment } from '@supermarket/shared-infra';
import { AppLoggerService, SERVICE_ENVIRONMENT } from '@supermarket/shared-infra';

import type { ManagementEventPublisherPort } from '../../application/ports/management-event-publisher.port';

@Injectable()
export class KafkaManagementEventPublisherService
  implements ManagementEventPublisherPort, OnApplicationShutdown
{
  private readonly producer: Producer;
  private readonly kafka: Kafka;
  private connectionPromise?: Promise<void>;
  private connected = false;

  constructor(
    @Inject(SERVICE_ENVIRONMENT)
    private readonly environment: ServiceEnvironment,
    private readonly logger: AppLoggerService
  ) {
    this.kafka = new Kafka({
      clientId: this.environment.kafka.clientId,
      brokers: this.environment.kafka.brokers
    });
    this.producer = this.kafka.producer();
  }

  async publish<TPayload extends EventPayload>(event: EventEnvelope<TPayload>): Promise<void> {
    await this.ensureConnected();
    await this.producer.send({
      topic: event.topic,
      messages: [
        {
          key: event.aggregateId,
          value: JSON.stringify(event),
          headers: {
            'event-id': event.eventId,
            'event-name': event.eventName,
            'tenant-id': event.tenantId
          }
        }
      ]
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.connected) {
      return;
    }

    await this.producer.disconnect();
    this.connected = false;
    this.logger.log('Kafka producer disconnected');
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (this.connectionPromise === undefined) {
      this.connectionPromise = this.producer
        .connect()
        .then(() => {
          this.connected = true;
          this.logger.log('Kafka producer connected');
        })
        .catch((error: unknown) => {
          this.connectionPromise = undefined;
          throw error;
        });
    }

    await this.connectionPromise;
  }
}
