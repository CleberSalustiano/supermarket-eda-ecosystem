'use strict';

const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RUN_DIR = path.join(REPO_ROOT, '.local-run');
const LOG_DIR = path.join(RUN_DIR, 'logs');
const PID_DIR = path.join(RUN_DIR, 'pids');
const SEED_STATE_FILE = path.join(RUN_DIR, 'seed-state.json');
const INTERNAL_API_TOKEN_FILE = path.join(RUN_DIR, 'internal-api-token');
const TEST_DATA_FILE = path.join(RUN_DIR, 'test-data.md');
const SEED_DATA_FILE = path.join(__dirname, 'seed-data.json');
const COMPOSE_FILE = path.join(REPO_ROOT, 'docker-compose.yml');

function resolveFrontendDir() {
  return process.env.FRONTEND_APPS_DIR ?? path.resolve(REPO_ROOT, '..', 'frontend-apps');
}

module.exports = {
  REPO_ROOT,
  RUN_DIR,
  LOG_DIR,
  PID_DIR,
  SEED_STATE_FILE,
  INTERNAL_API_TOKEN_FILE,
  TEST_DATA_FILE,
  SEED_DATA_FILE,
  COMPOSE_FILE,
  resolveFrontendDir
};
