'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const infra = require('./infra');
const { REPO_ROOT } = require('./paths');
const processes = require('./processes');
const { SERVICES } = require('./services');

const MIN_NODE = [20, 19, 0];
const INFRA_PORTS = [5433, 5434, 5435, 19092, 8080];
const WEB_PORTS = [4100, 4101, 4102];
const MOBILE_PORT = 8081;

function nodeVersionOk(version = process.versions.node) {
  const parts = version.split('.').map(Number);
  for (let index = 0; index < MIN_NODE.length; index += 1) {
    if (parts[index] !== MIN_NODE[index]) {
      return parts[index] > MIN_NODE[index];
    }
  }
  return true;
}

function frontendRunning(frontendDir) {
  const pidDir = path.join(frontendDir, '.local-run', 'pids');
  try {
    return fs
      .readdirSync(pidDir)
      .some((file) => processes.isAlive(Number.parseInt(fs.readFileSync(path.join(pidDir, file), 'utf8'), 10)));
  } catch {
    return false;
  }
}

/** Ports the stack needs, grouped by owner; a group already running is not a conflict. */
function portGroups({ withFrontend, withMobile, infraRunning, frontendDir }) {
  const groups = [{ ports: INFRA_PORTS, owned: infraRunning }];
  for (const service of SERVICES) {
    groups.push({ ports: [service.port], owned: processes.isAlive(processes.readPid(service.name)) });
  }
  if (withFrontend) {
    const owned = frontendRunning(frontendDir);
    groups.push({ ports: [...WEB_PORTS, ...(withMobile ? [MOBILE_PORT] : [])], owned });
  }
  return groups;
}

function ensureDocker({ startDocker }) {
  if (infra.isDockerReachable()) {
    return null;
  }
  if (startDocker && infra.isOnPath('colima')) {
    console.log('Docker is not reachable; starting Colima (this can take a minute)...');
    spawnSync('colima', ['start'], { stdio: 'inherit' });
    if (infra.isDockerReachable()) {
      return null;
    }
  }
  return 'Docker is not reachable. Start Docker Desktop or run `colima start`, then retry.';
}

async function busyForeignPorts(groups) {
  const busy = [];
  for (const group of groups.filter((candidate) => !candidate.owned)) {
    for (const port of group.ports) {
      if (!(await processes.isPortFree(port))) {
        busy.push(port);
      }
    }
  }
  return busy;
}

/**
 * Returns the list of problems (empty when ready). Ports held by components of this
 * stack (pid files, containers) are not conflicts.
 */
async function checkPrerequisites({ withFrontend, withMobile, startDocker, frontendDir }) {
  const problems = [];

  if (!nodeVersionOk()) {
    problems.push(`Node >= ${MIN_NODE.join('.')} is required (found ${process.versions.node}).`);
  }
  if (!fs.existsSync(path.join(REPO_ROOT, 'node_modules'))) {
    problems.push('backend-services/node_modules is missing. Run `npm install` in backend-services.');
  }
  if (withFrontend && !fs.existsSync(path.join(frontendDir, 'node_modules'))) {
    problems.push(`${frontendDir}/node_modules is missing. Run \`npm install\` there (or pass --no-frontend).`);
  }

  const dockerProblem = ensureDocker({ startDocker });
  if (dockerProblem) {
    problems.push(dockerProblem);
    return { problems, compose: null };
  }

  const compose = infra.detectCompose();
  if (!compose) {
    problems.push('Neither `docker compose` nor `docker-compose` is available. Install Docker Compose.');
  }

  const infraRunning = compose !== null && infra.infraContainersRunning(compose);
  const busy = await busyForeignPorts(portGroups({ withFrontend, withMobile, infraRunning, frontendDir }));
  if (busy.length > 0) {
    problems.push(
      `Ports already in use by other processes: ${busy.join(', ')}. Free them or run \`npm run local:down\`.`
    );
  }

  return { problems, compose };
}

module.exports = { checkPrerequisites, nodeVersionOk, portGroups };
