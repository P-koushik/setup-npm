import { execSync } from 'child_process';
import ora from 'ora';
import { FrontendConfig } from '../types/frontend-config.js';

export async function buildFrontend(config: FrontendConfig) {
  const spinner = ora('Creating frontend project...').start();

  try {
    spinner.stop(); // stop spinner before interactive CLI

    runCommand(`Scaffolding ${config.framework} project`, getCommand(config));

    runPostSetup(config);

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
  const { framework, projectName } = config;

  switch (framework) {
    case 'next':
      return `npx create-next-app@latest ${projectName}`;

    case 'angular':
      return `npx @angular/cli@latest new ${projectName}`;

    case 'vue':
      return `npm create vue@latest ${projectName}`;

    case 'vite':
      return `npm create vite@latest ${projectName}`;

    case 'expo':
      return `npx create-expo-app ${projectName}`;

    case 'react-native':
      return `npx react-native init ${projectName}`;

    default:
      throw new Error('Unsupported framework');
  }
}

function runPostSetup(config: FrontendConfig) {
  const { framework, projectName } = config;

  if (framework !== 'vue') {
    return;
  }

  runCommand('Installing dependencies', 'npm install', projectName);
}

function runCommand(step: string, command: string, cwd?: string) {
  console.log(`\n▶ ${step}`);
  console.log(`$ ${cwd ? `cd ${cwd} && ` : ''}${command}\n`);

  execSync(command, {
    cwd,
    stdio: 'inherit'
  });
}
