'use strict';

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { COMPOSE_FILE, LOG_DIR, REPO_ROOT } = require('./paths');

function succeeds(command, args) {
  return spawnSync(command, args, { stdio: 'ignore' }).status === 0;
}

function detectCompose() {
  if (succeeds('docker', ['compose', 'version'])) {
    return { command: 'docker', prefix: ['compose'] };
  }
  if (succeeds('docker-compose', ['version'])) {
    return { command: 'docker-compose', prefix: [] };
  }
  return null;
}

function isDockerReachable() {
  return succeeds('docker', ['info']);
}

function isOnPath(binary) {
  return spawnSync('which', [binary], { stdio: 'ignore' }).status === 0;
}

function runCompose(compose, args, { logName = 'infra' } = {}) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logPath = path.join(LOG_DIR, `${logName}.log`);
  const fd = fs.openSync(logPath, 'a');
  const result = spawnSync(
    compose.command,
    [...compose.prefix, '-f', COMPOSE_FILE, ...args],
    { cwd: REPO_ROOT, stdio: ['ignore', fd, fd] }
  );
  fs.closeSync(fd);
  return { ok: result.status === 0, logPath };
}

function startInfra(compose) {
  return runCompose(compose, ['up', '-d', '--wait', '--wait-timeout', '180']);
}

function stopInfra(compose, { purge }) {
  return runCompose(compose, purge ? ['down', '-v'] : ['stop']);
}

function composePs(compose) {
  return execFileSync(compose.command, [...compose.prefix, '-f', COMPOSE_FILE, 'ps'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function infraContainersRunning(compose) {
  try {
    return composePs(compose).includes('supermarket-kafka');
  } catch {
    return false;
  }
}

module.exports = {
  detectCompose,
  isDockerReachable,
  isOnPath,
  startInfra,
  stopInfra,
  composePs,
  infraContainersRunning
};
