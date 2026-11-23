'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { test } = require('node:test');

const { parseArgs } = require('./cli');

const CLI = path.join(__dirname, 'cli.js');

test('stop parses the service name', () => {
  assert.deepEqual(parseArgs(['stop', 'checkout-service']), {
    command: 'stop',
    serviceName: 'checkout-service',
    extraArgs: []
  });
});

test('stop with an unknown service lists valid names and exits 2', () => {
  const result = spawnSync(process.execPath, [CLI, 'stop', 'nope-service'], { encoding: 'utf8' });

  assert.equal(result.status, 2);
  for (const name of ['checkout-service', 'inventory-service', 'management-service']) {
    assert.ok(result.stderr.includes(name), name);
  }
});

test('stop without a name exits 2', () => {
  assert.equal(spawnSync(process.execPath, [CLI, 'stop'], { encoding: 'utf8' }).status, 2);
});

test('up flags are still parsed', () => {
  assert.equal(parseArgs(['up', '--skip-build', '--no-seed']).seed, false);
  assert.throws(() => parseArgs(['up', '--bogus']), /Unknown flag/);
});
