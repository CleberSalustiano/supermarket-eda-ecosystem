const { execFileSync, spawnSync } = require('node:child_process');

function resolveDockerHost() {
  if (process.env.DOCKER_HOST) {
    return process.env.DOCKER_HOST;
  }

  try {
    const currentContext = execFileSync('docker', ['context', 'show'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();

    if (currentContext.length === 0) {
      return undefined;
    }

    const inspectionOutput = execFileSync('docker', ['context', 'inspect', currentContext], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const inspectedContexts = JSON.parse(inspectionOutput);

    return inspectedContexts[0]?.Endpoints?.docker?.Host;
  } catch {
    return undefined;
  }
}

function runCommand(command, args, env) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env
  });

  if (typeof result.status === 'number') {
    return result.status;
  }

  if (result.error) {
    throw result.error;
  }

  return 1;
}

function main() {
  const env = { ...process.env };
  const dockerHost = resolveDockerHost();

  if (dockerHost) {
    env.DOCKER_HOST = dockerHost;
  }

  if (
    dockerHost?.startsWith('unix:///Users/') &&
    dockerHost.includes('/.colima/')
  ) {
    env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE =
      env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE ?? '/var/run/docker.sock';
    env.TESTCONTAINERS_HOST_OVERRIDE = env.TESTCONTAINERS_HOST_OVERRIDE ?? '127.0.0.1';
    env.TESTCONTAINERS_RYUK_DISABLED = env.TESTCONTAINERS_RYUK_DISABLED ?? 'true';
  }

  const integrationExitCode = runCommand(
    'npx',
    [
      'jest',
      '--selectProjects',
      'integration:checkout-service',
      'integration:inventory-service',
      'integration:management-service'
    ],
    env
  );
  const cleanupExitCode = runCommand('npm', ['run', 'clean:shared-domain-artifacts'], env);

  process.exit(integrationExitCode !== 0 ? integrationExitCode : cleanupExitCode);
}

main();
