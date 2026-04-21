import { execSync } from 'child_process';
import {
  getNodeVersion,
  hasCommand,
  isNodeVersionSupported
} from '../../utils/env.js';
import { failure, fixList, step, success } from '../../utils/logger.js';

export async function ensureNodePreflight() {
  const nodeVersion = getNodeVersion();

  if (nodeVersion && isNodeVersionSupported(nodeVersion)) {
    success(`Node version OK (${nodeVersion})`);
    return;
  }

  failure('Node version >= 18 required');
  fixList([
    'Install Node.js 18 or newer',
    'Restart your shell after upgrading Node.js'
  ]);
  throw new Error('Node environment checks failed');
}

export async function ensurePackageManagerAvailable(
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
) {
  const command = packageManager === 'bun' ? 'bun' : packageManager;

  if (hasCommand(command)) {
    success(`${packageManager} available`);
    return;
  }

  failure(`${packageManager} available`);
  fixList(packageManagerFixes(packageManager));

  const installCommand = autoInstallCommand(packageManager);

  if (!installCommand) {
    throw new Error(`${packageManager} is required for this setup step`);
  }

  step(`Installing missing package manager: ${packageManager}`);
  console.log(`$ ${installCommand}\n`);

  try {
    execSync(installCommand, { stdio: 'inherit' });
  } catch {
    throw new Error(
      `Failed to install ${packageManager} automatically. Install it and rerun setup resume`
    );
  }

  if (!hasCommand(command)) {
    throw new Error(
      `${packageManager} installation finished but the command is still unavailable. Restart your shell and rerun setup resume`
    );
  }

  success(`${packageManager} installed`);
}

export async function ensureCommandAvailable(command: string, fixes: string[]) {
  if (hasCommand(command)) {
    success(`${command} available`);
    return;
  }

  failure(`${command} available`);
  fixList(fixes);
  throw new Error(`${command} is required for this setup step`);
}

function packageManagerFixes(packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun') {
  switch (packageManager) {
    case 'pnpm':
      return ['Install pnpm globally: npm install -g pnpm'];
    case 'yarn':
      return ['Install Yarn globally: npm install -g yarn'];
    case 'bun':
      return ['Install Bun from https://bun.sh'];
    case 'npm':
      return ['Install Node.js with npm'];
  }
}

function autoInstallCommand(
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
): string | null {
  switch (packageManager) {
    case 'pnpm':
      return hasCommand('npm') ? 'npm install -g pnpm' : null;
    case 'yarn':
      return hasCommand('npm') ? 'npm install -g yarn' : null;
    case 'npm':
      return null;
    case 'bun':
      return null;
  }
}

export async function ensureAndroidPreflight() {
  const ok = await import('../doctor/index.js').then(({ runDoctor }) =>
    runDoctor('android')
  );

  if (!ok) {
    throw new Error('Android environment checks failed');
  }
}

export async function ensurePythonPreflight() {
  if (hasCommand('python3') || hasCommand('python')) {
    success('Python available');
    return;
  }

  failure('Python available');
  fixList(['Install Python 3', 'Add python3 to PATH']);
  throw new Error('Python environment checks failed');
}

export async function ensureJavaPreflight() {
  if (hasCommand('java')) {
    success('Java available');
    return;
  }

  failure('Java available');
  fixList(['Install Java 21 or newer', 'Add Java to PATH']);
  throw new Error('Java environment checks failed');
}
