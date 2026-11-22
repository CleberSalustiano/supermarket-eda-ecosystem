#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const infra = require('./infra');
const paths = require('./paths');
const { checkPrerequisites } = require('./prerequisites');
const processes = require('./processes');
const { seedLocalData } = require('./seed');
const services = require('./services');
const { renderTestData } = require('./test-data-report');

const COMMANDS = ['up', 'down', 'status', 'seed'];
const FLAGS = ['--reset', '--skip-build', '--with-mobile', '--no-frontend', '--no-seed', '--no-start-docker', '--purge'];
const BASE_URLS = {
  checkout: 'http://localhost:3001',
  inventory: 'http://localhost:3002',
  management: 'http://localhost:3003'
};

function parseArgs(argv) {
  const [command, ...flags] = argv;
  if (!COMMANDS.includes(command)) {
    throw new Error(`Usage: cli.js <${COMMANDS.join('|')}> [${FLAGS.join('] [')}]`);
  }
  const unknown = flags.filter((flag) => !FLAGS.includes(flag));
  if (unknown.length > 0) {
    throw new Error(`Unknown flag(s): ${unknown.join(', ')}`);
  }
  const has = (flag) => flags.includes(flag);
  return {
    command,
    reset: has('--reset'),
    skipBuild: has('--skip-build'),
    withMobile: has('--with-mobile'),
    withFrontend: !has('--no-frontend'),
    seed: !has('--no-seed'),
    startDocker: !has('--no-start-docker'),
    purge: has('--purge')
  };
}

class StepError extends Error {
  constructor(step, logPath, detail) {
    super(`${step} failed`);
    this.step = step;
    this.logPath = logPath;
    this.detail = detail;
  }
}

function progress(message) {
  console.log(`==> ${message}`);
}

function frontendScript() {
  const script = path.join(paths.resolveFrontendDir(), 'scripts', 'local-web-apps.js');
  return fs.existsSync(script) ? script : null;
}

function runFrontend(args) {
  const script = frontendScript();
  if (!script) {
    return null;
  }
  return spawnSync(process.execPath, [script, ...args], {
    cwd: paths.resolveFrontendDir(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  });
}

function parseFrontendJson(stdout) {
  const lastLine = stdout.trim().split('\n').pop();
  return JSON.parse(lastLine).apps;
}

function loadSeedState() {
  try {
    return JSON.parse(fs.readFileSync(paths.SEED_STATE_FILE, 'utf8'));
  } catch {
    return { employees: {}, products: {} };
  }
}

function saveSeedState(state) {
  fs.mkdirSync(paths.RUN_DIR, { recursive: true });
  fs.writeFileSync(paths.SEED_STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

function deleteSeedFiles() {
  fs.rmSync(paths.SEED_STATE_FILE, { force: true });
  fs.rmSync(paths.TEST_DATA_FILE, { force: true });
}

async function stopEverything({ purge }) {
  const stopped = [];
  const frontend = runFrontend(['stop']);
  if (frontend) {
    stopped.push('web apps');
  }
  for (const service of services.SERVICES) {
    if (await processes.stopProcess(service.name)) {
      stopped.push(service.name);
    }
  }
  const compose = infra.isDockerReachable() ? infra.detectCompose() : null;
  if (compose) {
    const result = infra.stopInfra(compose, { purge });
    if (!result.ok) {
      throw new StepError('Stopping infra', result.logPath);
    }
    stopped.push(purge ? 'infra (volumes removed)' : 'infra');
  }
  if (purge) {
    deleteSeedFiles();
  }
  return stopped;
}

async function down({ purge }) {
  const stopped = await stopEverything({ purge });
  console.log(stopped.length > 0 ? `Stopped: ${stopped.join(', ')}` : 'Nothing was running.');
}

function makeSeedLogger() {
  fs.mkdirSync(paths.LOG_DIR, { recursive: true });
  const file = path.join(paths.LOG_DIR, 'seed.log');
  return (message) => {
    fs.appendFileSync(file, `${new Date().toISOString()} ${message}\n`);
    console.log(`    ${message}`);
  };
}

async function runSeed({ withFrontend, withMobile }) {
  progress('Seeding test data');
  const data = JSON.parse(fs.readFileSync(paths.SEED_DATA_FILE, 'utf8'));
  const log = makeSeedLogger();
  let state;
  try {
    state = await seedLocalData({ baseUrls: BASE_URLS, data, state: loadSeedState(), log });
  } catch (error) {
    throw new StepError('Seeding', path.join(paths.LOG_DIR, 'seed.log'), error.message);
  }
  saveSeedState(state);
  const report = renderTestData({
    data,
    state,
    today: new Date().toISOString().slice(0, 10),
    withFrontend,
    withMobile,
    logDir: paths.LOG_DIR
  });
  fs.writeFileSync(paths.TEST_DATA_FILE, report);
  console.log(`\n${report}`);
}

async function startServices({ skipBuild }) {
  if (services.anyServiceRunning() && !skipBuild) {
    throw new StepError(
      'Build',
      null,
      'Services are running; refusing to rebuild. Run `npm run local:down` first or pass --skip-build.'
    );
  }
  if (skipBuild && services.distComplete()) {
    progress('Reusing existing dist/ (--skip-build)');
  } else {
    progress('Building (npm run build)');
    const build = services.runBuild();
    if (!build.ok) {
      throw new StepError('Build', build.logPath);
    }
  }
  for (const service of services.SERVICES) {
    progress(`Starting ${service.name} on :${service.port}`);
    const started = await services.startService(service);
    if (!started.ok) {
      throw new StepError(`Starting ${service.name}`, started.logPath);
    }
  }
}

function startFrontend({ withMobile }) {
  if (!frontendScript()) {
    console.warn(`WARNING: ${paths.resolveFrontendDir()}/scripts/local-web-apps.js not found; continuing backend-only.`);
    return false;
  }
  progress('Starting web apps');
  const result = runFrontend(['start', '--json', ...(withMobile ? ['--with-mobile'] : [])]);
  let apps = [];
  try {
    apps = parseFrontendJson(result.stdout);
  } catch {
    throw new StepError('Starting web apps', null, result.stdout);
  }
  for (const app of apps) {
    console.log(`    ${app.name}: ${app.status} ${app.url}`);
  }
  const failed = apps.find((app) => app.status !== 'running');
  if (result.status !== 0 || failed) {
    throw new StepError(`Starting ${failed?.name ?? 'web apps'}`, failed?.log ?? null);
  }
  return true;
}

async function up(options) {
  if (options.reset) {
    progress('Resetting: stopping everything and removing volumes');
    await stopEverything({ purge: true });
  }
  const { problems, compose } = await checkPrerequisites({
    withFrontend: options.withFrontend,
    withMobile: options.withMobile,
    startDocker: options.startDocker,
    frontendDir: paths.resolveFrontendDir()
  });
  if (problems.length > 0) {
    throw new StepError('Prerequisites', null, problems.map((problem) => `- ${problem}`).join('\n'));
  }

  progress('Starting infra (Postgres x3, Kafka, Kafka UI)');
  const infraResult = infra.startInfra(compose);
  if (!infraResult.ok) {
    throw new StepError('Starting infra', infraResult.logPath);
  }

  await startServices(options);
  const withFrontend = options.withFrontend && startFrontend(options);
  if (options.seed) {
    await runSeed({ withFrontend, withMobile: options.withMobile });
  } else {
    console.log('Stack is up. Stop it with `npm run local:down`.');
  }
}

async function status() {
  for (const service of services.SERVICES) {
    const pid = processes.readPid(service.name);
    const listening = await processes.isPortListening(service.port);
    const healthy = await processes.isHealthy(services.healthUrl(service));
    console.log(
      `${service.name}: pid ${pid ?? '-'} ${processes.isAlive(pid) ? 'alive' : 'not running'}, ` +
        `port ${service.port} ${listening ? 'listening' : 'closed'}, health ${healthy ? 'ok' : 'down'}`
    );
  }
  const web = runFrontend(['status']);
  if (web) {
    process.stdout.write(web.stdout);
  }
  const compose = infra.isDockerReachable() ? infra.detectCompose() : null;
  if (compose) {
    process.stdout.write(infra.composePs(compose));
  } else {
    console.log('Docker is not reachable; infra status unavailable.');
  }
}

function reportFailure(error) {
  console.error(`\nFAILED: ${error.step ?? 'Unexpected error'}`);
  if (error.detail) {
    console.error(error.detail);
  }
  if (error.logPath) {
    console.error(`Log: ${error.logPath}`);
    console.error(processes.tailFile(error.logPath, 30));
  }
  if (!error.step) {
    console.error(error.stack ?? error.message);
  }
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.command === 'down') {
    return down(options);
  }
  if (options.command === 'status') {
    return status();
  }
  if (options.command === 'seed') {
    return runSeed({ withFrontend: Boolean(frontendScript()), withMobile: false });
  }
  return up(options);
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    () => process.exit(0),
    (error) => {
      reportFailure(error);
      process.exit(1);
    }
  );
}

module.exports = { parseArgs };
