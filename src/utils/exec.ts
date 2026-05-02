import { execSync, spawnSync } from 'child_process';

export type CommandProbeResult = {
  ok: boolean;
  command: string;
  exitCode: number | null;
  error?: Error;
};

export function runCommandProbe(
  command: string,
  args: string[] = ['--version']
): CommandProbeResult {
  const result = spawnSync(command, args, {
    stdio: 'ignore',
    shell: process.platform === 'win32',
    windowsHide: true
  });

  return {
    ok: !result.error && result.status === 0,
    command,
    exitCode: result.status,
    error: result.error
  };
}

export function commandExists(
  command: string,
  args: string[] = ['--version']
): boolean {
  return runCommandProbe(command, args).ok;
}

export function capture(command: string, cwd?: string): string | null {
  try {
    return execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}
