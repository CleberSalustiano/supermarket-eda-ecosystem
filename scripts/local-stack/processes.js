'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const { LOG_DIR, PID_DIR } = require('./paths');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function pidFile(name) {
  return path.join(PID_DIR, `${name}.pid`);
}

function logFile(name) {
  return path.join(LOG_DIR, `${name}.log`);
}

function readPid(name) {
  try {
    const pid = Number.parseInt(fs.readFileSync(pidFile(name), 'utf8').trim(), 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isAlive(pid) {
  if (!pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port);
  });
}

async function isPortListening(port) {
  return !(await isPortFree(port));
}

function tailFile(file, lines = 30) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').slice(-lines - 1).join('\n').trimEnd();
  } catch {
    return '(log not available)';
  }
}

function spawnDetached({ name, command, args, cwd, env }) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.mkdirSync(PID_DIR, { recursive: true });
  const fd = fs.openSync(logFile(name), 'a');
  const child = spawn(command, args, {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', fd, fd]
  });
  fs.closeSync(fd);
  fs.writeFileSync(pidFile(name), String(child.pid));
  child.unref();
  return child.pid;
}

function signalGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // stale pid
    }
  }
}

async function stopProcess(name, { timeoutMs = 10_000 } = {}) {
  const pid = readPid(name);
  if (pid && isAlive(pid)) {
    signalGroup(pid, 'SIGTERM');
    const deadline = Date.now() + timeoutMs;
    while (isAlive(pid) && Date.now() < deadline) {
      await sleep(200);
    }
    if (isAlive(pid)) {
      signalGroup(pid, 'SIGKILL');
    }
  }
  const existed = pid !== null;
  fs.rmSync(pidFile(name), { force: true });
  return existed && pid !== null;
}

async function fetchStatus(url, timeoutMs = 2_000) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { status: response.status, response };
  } catch {
    return { status: 0, response: null };
  }
}

async function isHealthy(url) {
  const { status, response } = await fetchStatus(url);
  if (status !== 200) {
    return false;
  }
  try {
    return (await response.json()).status === 'ok';
  } catch {
    return false;
  }
}

async function waitFor(predicate, { timeoutMs, intervalMs = 1_000 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return true;
    }
    await sleep(intervalMs);
  }
  return false;
}

module.exports = {
  sleep,
  pidFile,
  logFile,
  readPid,
  isAlive,
  isPortFree,
  isPortListening,
  tailFile,
  spawnDetached,
  stopProcess,
  isHealthy,
  waitFor
};
