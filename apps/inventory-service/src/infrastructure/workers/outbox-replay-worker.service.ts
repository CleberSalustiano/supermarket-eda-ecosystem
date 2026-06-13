import { clearInterval, setInterval } from 'timers';

import { Inject, Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';

import type { ServiceEnvironment } from '@supermarket/shared-infra';
import { AppLoggerService, SERVICE_ENVIRONMENT } from '@supermarket/shared-infra';

import {
  OUTBOX_REPLAY_OPTIONS,
  type OutboxReplayOptions
} from '#/application/ports/outbox-replay.options';
import { ReplayPendingOutboxEventsUseCase } from '#/application/use-cases/replay-pending-outbox-events.use-case';

@Injectable()
export class OutboxReplayWorkerService implements OnModuleInit, OnApplicationShutdown {
  private interval?: NodeJS.Timeout;
  private runInFlight = false;

  constructor(
    @Inject(SERVICE_ENVIRONMENT)
    private readonly environment: ServiceEnvironment,
    private readonly logger: AppLoggerService,
    private readonly replayPendingOutboxEventsUseCase: ReplayPendingOutboxEventsUseCase,
    @Inject(OUTBOX_REPLAY_OPTIONS)
    private readonly options: OutboxReplayOptions
  ) {}

  onModuleInit(): void {
    if (this.environment.nodeEnvironment === 'test') {
      return;
    }

    void this.runNow();
    this.interval = setInterval(() => {
      void this.runNow();
    }, this.options.intervalMs);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  async runNow(): Promise<void> {
    if (this.runInFlight) {
      return;
    }

    this.runInFlight = true;

    try {
      const result = await this.replayPendingOutboxEventsUseCase.execute();

      if (result.scannedEvents > 0) {
        this.logger.log(
          `Replayed ${result.publishedEvents} inventory outbox events from ${result.scannedEvents} pending records`
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown error while replaying inventory outbox events';

      this.logger.error(
        `Failed to replay inventory outbox events: ${message}`,
        error instanceof Error ? error.stack : undefined
      );
    } finally {
      this.runInFlight = false;
    }
  }
}
