import { execSync } from 'child_process';

export function commandExists(command: string): boolean {
  try {
    execSync(`${command} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
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
