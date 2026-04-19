import inquirer from 'inquirer';
import { buildFrontend } from '../engine/frontendBuilder.js';
import { FrontendConfig } from '../types/frontend-config.js';
import {
  beginRun,
  clearRun,
  completeStep,
  failStep,
  updateProjectConfig
} from '../utils/state.js';

export async function frontend(preset?: Record<string, unknown>) {
  try {
    const config = await resolveFrontendConfig(preset);

    await beginRun(process.cwd(), {
      command: 'frontend',
      projectPath: config.projectName,
      input: config as unknown as Record<string, unknown>,
      steps: [{ id: 'build-frontend', status: 'pending' }]
    });

    try {
      await buildFrontend(config);
      await completeStep(process.cwd(), 'build-frontend');
    } catch {
      await failStep(process.cwd(), 'build-frontend');
      throw new Error('Frontend build failed');
    }

    await updateProjectConfig(process.cwd(), {
      projectName: config.projectName,
      frontend: config.framework,
      packageManager: config.packageManager
    });
    await clearRun(process.cwd());
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      console.log('\n❌ Operation cancelled by user\n');
      process.exit(0);
    }

    console.error('❌ Something went wrong:', error);
    process.exit(1);
  }
}

async function resolveFrontendConfig(
  preset?: Record<string, unknown>
): Promise<FrontendConfig> {
  const platform =
    preset?.platform ??
    (
      await inquirer.prompt([
        {
          type: 'list',
          name: 'platform',
          message: 'Choose platform:',
          choices: [
            { name: 'Web 🌐', value: 'web' },
            { name: 'Native 📱', value: 'native' }
          ]
        }
      ])
    ).platform;

  const framework =
    preset?.framework ??
    (
      await inquirer.prompt([
        {
          type: 'list',
          name: 'framework',
          message: 'Choose framework:',
          choices:
            platform === 'web'
              ? [
                  { name: 'Next.js (recommended)', value: 'next' },
                  { name: 'Angular', value: 'angular' },
                  { name: 'Vue', value: 'vue' },
                  { name: 'React (Vite)', value: 'vite' }
                ]
              : [
                  { name: 'Expo (recommended)', value: 'expo' },
                  { name: 'React Native CLI', value: 'react-native' }
                ]
        }
      ])
    ).framework;

  const projectName =
    typeof preset?.projectName === 'string'
      ? preset.projectName
      : (
          await inquirer.prompt([
            {
              type: 'input',
              name: 'projectName',
              message: 'Project name:',
              validate: (input) => (input ? true : 'Project name is required')
            }
          ])
        ).projectName;

  return {
    platform: platform as FrontendConfig['platform'],
    framework: framework as FrontendConfig['framework'],
    projectName,
    destinationDir:
      typeof preset?.destinationDir === 'string'
        ? preset.destinationDir
        : undefined,
    packageManager:
      typeof preset?.packageManager === 'string'
        ? (preset.packageManager as FrontendConfig['packageManager'])
        : undefined
  };
}
