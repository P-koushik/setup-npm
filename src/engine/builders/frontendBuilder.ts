import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import { FrontendConfig } from '../../types/frontend-config.js';

export async function buildFrontend(config: FrontendConfig) {
  const spinner = ora('Creating frontend project...').start();

  try {
    spinner.stop(); // stop spinner before interactive CLI

    runCommand(
      `Scaffolding ${config.framework} project`,
      getCommand(config),
      config.destinationDir
    );

    await runPostSetup(config);

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
        ? `bunx @react-native-community/cli init ${projectName}`
        : `npx @react-native-community/cli init ${projectName}`;

    default:
      throw new Error('Unsupported framework');
  }
}

async function runPostSetup(config: FrontendConfig) {
  const {
    framework,
    projectName,
    destinationDir,
    packageManager = 'npm'
  } = config;

  const projectDir = resolveProjectDir(projectName, destinationDir);

  if (framework === 'react-native' && shouldSkipGit(config)) {
    await fs.remove(path.join(projectDir, '.git'));
  }

  if (framework === 'vue') {
    runCommand(
      'Installing dependencies',
      installCommand(packageManager),
      projectDir
    );
  }
}

function shouldSkipGit(config: FrontendConfig) {
  return Boolean(config.destinationDir);
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
