import fs from 'fs-extra';
import path from 'path';
import { capture, commandExists } from './exec.js';

export function getNodeVersion(): string | null {
  return capture('node --version');
}

export function isNodeVersionSupported(version: string | null): boolean {
  if (!version) {
    return false;
  }

  const match = version.match(/\d+/);
  return match ? Number(match[0]) >= 18 : false;
}

export async function pathExists(
  targetPath: string | undefined
): Promise<boolean> {
  if (!targetPath) {
    return false;
  }

  return fs.pathExists(targetPath);
}

export async function androidSdkExists(): Promise<boolean> {
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

  if (!androidHome) {
    return false;
  }

  return fs.pathExists(path.resolve(androidHome));
}

export function hasCommand(command: string): boolean {
  return commandExists(command);
}
