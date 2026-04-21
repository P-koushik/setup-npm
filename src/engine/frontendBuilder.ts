import { execSync } from 'child_process';
import ora from 'ora';
import { validateFrontendOutput } from './validators/post-setup.js';
import {
  ensureCommandAvailable,
  ensurePackageManagerAvailable
} from './validators/preflight.js';
import { FrontendConfig } from '../types/frontend-config.js';

export async function buildFrontend(config: FrontendConfig) {
  const spinner = ora('Creating frontend project...').start();

  try {
    spinner.stop(); // stop spinner before interactive CLI
    await ensureFrontendTooling(config);

    runCommand(
      `Scaffolding ${config.framework} project`,
      getCommand(config),
      config.destinationDir
    );

    runPostSetup(config);
    await validateFrontendOutput(
      config,
      resolveProjectDir(config.projectName, config.destinationDir)
    );

    spinner.succeed('Frontend setup complete 🚀');
  } catch (error: unknown) {
    spinner.fail('Failed to create frontend');

    if (error instanceof Error) {
      console.error(error.message);
    }

    process.exit(1);
  }
}

function getCommand(config: FrontendConfig): string {
  const { framework, projectName, packageManager = 'npm' } = config;

  switch (framework) {
    case 'next':
      return packageManager === 'bun'
        ? `bunx create-next-app@latest ${projectName}`
        : `npx create-next-app@latest ${projectName}`;

    case 'angular':
      return packageManager === 'bun'
        ? `bunx @angular/cli@latest new ${projectName}`
        : `npx @angular/cli@latest new ${projectName}`;

    case 'vue':
      return createCommand(packageManager, 'vue@latest', projectName);

    case 'vite':
      return createCommand(packageManager, 'vite@latest', projectName);

    case 'expo':
      return packageManager === 'bun'
        ? `bunx create-expo-app ${projectName}`
        : `npx create-expo-app ${projectName}`;

    case 'react-native':
      return packageManager === 'bun'
        ? `bunx react-native init ${projectName}`
        : `npx react-native init ${projectName}`;

    default:
      throw new Error('Unsupported framework');
  }
}

function runPostSetup(config: FrontendConfig) {
  const {
    framework,
    projectName,
    destinationDir,
    packageManager = 'npm'
  } = config;

  if (framework !== 'vue') {
    return;
  }

  runCommand(
    'Installing dependencies',
    installCommand(packageManager),
    resolveProjectDir(projectName, destinationDir)
  );
}

function runCommand(step: string, command: string, cwd?: string) {
  console.log(`\n▶ ${step}`);
  console.log(`$ ${cwd ? `cd ${cwd} && ` : ''}${command}\n`);

  execSync(command, {
    cwd,
    stdio: 'inherit'
  });
}

function resolveProjectDir(
  projectName: string,
  destinationDir?: string
): string {
  return destinationDir ? `${destinationDir}/${projectName}` : projectName;
}

function createCommand(
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun',
  initializer: string,
  projectName: string
): string {
  switch (packageManager) {
    case 'pnpm':
      return `pnpm create ${initializer} ${projectName}`;
    case 'yarn':
      return `yarn create ${initializer} ${projectName}`;
    case 'bun':
      return `bun create ${initializer} ${projectName}`;
    case 'npm':
      return `npm create ${initializer} ${projectName}`;
  }
}

function installCommand(
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
): string {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm install';
    case 'yarn':
      return 'yarn install';
    case 'bun':
      return 'bun install';
    case 'npm':
      return 'npm install';
  }
}

async function ensureFrontendTooling(config: FrontendConfig) {
  const packageManager = config.packageManager ?? 'npm';
  await ensurePackageManagerAvailable(packageManager);

  if (
    packageManager === 'npm' &&
    ['next', 'angular', 'expo', 'react-native'].includes(config.framework)
  ) {
    await ensureCommandAvailable('npx', ['Install Node.js with npm and npx']);
  }
}
