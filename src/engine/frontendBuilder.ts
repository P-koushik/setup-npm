import { execSync } from 'child_process';
import ora from 'ora';
import { FrontendConfig } from '../types/frontend-config.js';

export async function buildFrontend(config: FrontendConfig) {
  const spinner = ora('Creating frontend project...').start();

  try {
    const command = getCommand(config);

    spinner.stop(); // stop spinner before interactive CLI

    execSync(command, {
      stdio: 'inherit'
    });

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
