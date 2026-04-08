interface RuntimeRequireWindow {
  require?: (moduleName: string) => unknown;
}

interface RuntimeSpawnResult {
  status: number | null;
  stdout?: string | Buffer;
  stderr?: string | Buffer;
  error?: Error;
}

interface RuntimeChildProcess {
  spawnSync(
    command: string,
    args: string[],
    options?: { cwd?: string; encoding?: 'utf8' },
  ): RuntimeSpawnResult;
}

export interface GitCommandResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Check whether the current runtime can execute git commands.
 */
export function isGitRuntimeAvailable(): boolean {
  return getRuntimeChildProcess() !== null;
}

/**
 * Execute one git command and capture its process result.
 */
export function executeGitCommand(args: string[], cwd?: string): GitCommandResult {
  const childProcess = getRuntimeChildProcess();
  if (!childProcess) {
    return {
      ok: false,
      exitCode: null,
      stdout: '',
      stderr: 'child_process is not available in the current runtime.',
    };
  }

  const result = childProcess.spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
  });

  return {
    ok: result.status === 0 && !result.error,
    exitCode: result.status,
    stdout: toProcessOutput(result.stdout),
    stderr: result.error ? result.error.message : toProcessOutput(result.stderr),
  };
}

/**
 * Clone one git repository into the requested target directory.
 */
export function cloneGitRepository(url: string, targetDirectory: string): GitCommandResult {
  return executeGitCommand(['clone', '--depth', '1', url, targetDirectory]);
}

/**
 * Pull the latest changes for one checked-out git repository.
 */
export function pullGitRepository(targetDirectory: string): GitCommandResult {
  return executeGitCommand(['-C', targetDirectory, 'pull', '--ff-only']);
}

/**
 * Derive a stable bucket folder name from one repository URL.
 */
export function deriveBucketDirectoryName(url: string): string {
  const normalizedUrl = url.trim().replace(/[\\/]+$/u, '');
  const lastSegment = normalizedUrl.split('/').filter(Boolean).pop() ?? `bucket-${Date.now()}`;
  return lastSegment.replace(/\.git$/u, '').replace(/[^a-zA-Z0-9-_]+/gu, '-').toLowerCase();
}

/**
 * Resolve the child_process module through the runtime CommonJS bridge.
 */
function getRuntimeChildProcess(): RuntimeChildProcess | null {
  const runtimeRequire = getRuntimeRequire();
  if (!runtimeRequire) {
    return null;
  }

  try {
    return runtimeRequire('child_process') as RuntimeChildProcess;
  } catch {
    return null;
  }
}

/**
 * Resolve runtime require when the host exposes CommonJS access.
 */
function getRuntimeRequire(): ((moduleName: string) => unknown) | null {
  const globalWindow = typeof window !== 'undefined' ? window as unknown as RuntimeRequireWindow : null;
  if (globalWindow?.require) {
    return globalWindow.require;
  }

  try {
    return Function('return typeof require !== "undefined" ? require : null')() as (moduleName: string) => unknown;
  } catch {
    return null;
  }
}

/**
 * Normalize one process output value into a string.
 */
function toProcessOutput(value: string | Buffer | undefined): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof Buffer !== 'undefined' && value instanceof Buffer) {
    return value.toString('utf8').trim();
  }

  return '';
}