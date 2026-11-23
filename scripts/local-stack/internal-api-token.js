'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { INTERNAL_API_TOKEN_FILE } = require('./paths');

/**
 * Returns the machine-local internal API token, creating it (mode 0600) when missing.
 * The value is never printed or written to reports.
 */
function ensureInternalApiToken(file = INTERNAL_API_TOKEN_FILE) {
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length > 0) {
      return existing;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  const token = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${token}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return token;
}

module.exports = { ensureInternalApiToken };
