'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { LOG_DIR, REPO_ROOT } = require('./paths');
const processes = require('./processes');

const SERVICES = [
  { name: 'checkout-service', port: 3001 },
  { name: 'inventory-service', port: 3002 },
  { name: 'management-service', port: 3003 }
];

const healthUrl = (service) => `http://localhost:${service.port}/health`;
const mainFile = (service) => path.join(REPO_ROOT, 'dist', 'apps', service.name, 'main.js');
const distComplete = () => SERVICES.every((service) => fs.existsSync(mainFile(service)));

function runBuild() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logPath = path.join(LOG_DIR, 'build.log');
  const fd = fs.openSync(logPath, 'w');
  const result = spawnSync('npm', ['run', 'build'], { cwd: REPO_ROOT, stdio: ['ignore', fd, fd] });
  fs.closeSync(fd);
  return { ok: result.status === 0, logPath };
}

function serviceEnvironment() {
  return {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_MIGRATIONS_RUN: 'true',
    OUTBOX_REPLAY_INTERVAL_MS: '5000'
  };
}

async function startService(service, { timeoutMs = 120_000 } = {}) {
  if (await processes.isHealthy(healthUrl(service))) {
    return { ok: true, alreadyRunning: true };
  }
  processes.spawnDetached({
    name: service.name,
    command: process.execPath,
    args: [mainFile(service)],
    cwd: REPO_ROOT,
    env: serviceEnvironment()
  });
  const ok = await processes.waitFor(() => processes.isHealthy(healthUrl(service)), { timeoutMs });
  return { ok, alreadyRunning: false, logPath: processes.logFile(service.name) };
}

function anyServiceRunning() {
  return SERVICES.some((service) => processes.isAlive(processes.readPid(service.name)));
}

module.exports = {
  SERVICES,
  healthUrl,
  distComplete,
  runBuild,
  startService,
  anyServiceRunning
};
