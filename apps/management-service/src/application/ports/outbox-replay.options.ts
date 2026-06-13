export interface OutboxReplayOptions {
  intervalMs: number;
  batchSize: number;
}

export const OUTBOX_REPLAY_OPTIONS = Symbol('OUTBOX_REPLAY_OPTIONS');
