import type { OutboxReplayOptions } from '#/application/ports/outbox-replay.options';

export function createOutboxReplayOptions(
  source: NodeJS.ProcessEnv = process.env
): OutboxReplayOptions {
  return {
    intervalMs: parsePositiveInteger(
      source['OUTBOX_REPLAY_INTERVAL_MS'],
      30000,
      'OUTBOX_REPLAY_INTERVAL_MS'
    ),
    batchSize: parsePositiveInteger(
      source['OUTBOX_REPLAY_BATCH_SIZE'],
      100,
      'OUTBOX_REPLAY_BATCH_SIZE'
    )
  };
}

function parsePositiveInteger(
  rawValue: string | undefined,
  fallbackValue: number,
  label: string
): number {
  if (rawValue === undefined || rawValue.trim() === '') {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsedValue;
}
