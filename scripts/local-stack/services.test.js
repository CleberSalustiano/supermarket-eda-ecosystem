'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { ensureInternalApiToken } = require('./internal-api-token');
const { SERVICES, serviceEnvironment } = require('./services');

const service = (name) => SERVICES.find((candidate) => candidate.name === name);
const TOKEN = 'a'.repeat(64);

test('management receives only the token list', () => {
  const env = serviceEnvironment(service('management-service'), TOKEN);

  assert.equal(env.MANAGEMENT_INTERNAL_API_TOKENS, TOKEN);
  assert.equal(env.MANAGEMENT_INTERNAL_API_TOKEN, undefined);
  assert.equal(env.MANAGEMENT_SERVICE_BASE_URL, undefined);
});

test('checkout receives the single token and the management base URL', () => {
  const env = serviceEnvironment(service('checkout-service'), TOKEN);

  assert.equal(env.MANAGEMENT_INTERNAL_API_TOKEN, TOKEN);
  assert.equal(env.MANAGEMENT_SERVICE_BASE_URL, 'http://localhost:3003');
  assert.equal(env.MANAGEMENT_INTERNAL_API_TOKENS, undefined);
});

test('inventory receives no token; every service keeps the shared values', () => {
  const inventory = serviceEnvironment(service('inventory-service'), TOKEN);

  assert.equal(JSON.stringify(inventory).includes(TOKEN), false);
  for (const { name } of SERVICES) {
    const env = serviceEnvironment(service(name), TOKEN);
    assert.equal(env.NODE_ENV, 'development');
    assert.equal(env.DATABASE_MIGRATIONS_RUN, 'true');
    assert.equal(env.OUTBOX_REPLAY_INTERVAL_MS, '5000');
  }
});

test('token file is created with mode 0600, then reused', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-stack-token-'));
  const file = path.join(dir, 'nested', 'internal-api-token');
  try {
    const first = ensureInternalApiToken(file);
    const second = ensureInternalApiToken(file);

    assert.match(first, /^[0-9a-f]{64}$/);
    assert.equal(second, first);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an empty token file is regenerated', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-stack-token-'));
  const file = path.join(dir, 'internal-api-token');
  try {
    fs.writeFileSync(file, '\n');
    assert.match(ensureInternalApiToken(file), /^[0-9a-f]{64}$/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
