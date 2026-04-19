import inquirer from 'inquirer';
import { buildBackend } from '../engine/backendBuilder.js';
import { BackendConfig } from '../types/backend-config.js';
import {
  beginRun,
  clearRun,
  completeStep,
  failStep,
  updateProjectConfig
} from '../utils/state.js';

export async function backend(preset?: Record<string, unknown>) {
  try {
    const config = await resolveBackendConfig(preset);

    await beginRun(process.cwd(), {
      command: 'backend',
      projectPath: config.projectName,
      input: config as unknown as Record<string, unknown>,
      steps: [{ id: 'build-backend', status: 'pending' }]
    });

    try {
      await buildBackend(config);
      await completeStep(process.cwd(), 'build-backend');
    } catch {
      await failStep(process.cwd(), 'build-backend');
      throw new Error('Backend build failed');
    }

    await updateProjectConfig(process.cwd(), {
      projectName: config.projectName,
      backend: config.backendType,
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

async function resolveBackendConfig(
  preset?: Record<string, unknown>
): Promise<BackendConfig> {
  const projectName =
    typeof preset?.projectName === 'string'
      ? preset.projectName
      : (
          await inquirer.prompt([
            {
              type: 'input',
              name: 'projectName',
              message: 'Project name:',
              validate: (input: string) =>
                input ? true : 'Project name is required'
            }
          ])
        ).projectName;

  const backendType =
    preset?.backendType ??
    (
      await inquirer.prompt([
        {
          type: 'list',
          name: 'backendType',
          message: 'Choose backend type:',
          choices: [
            { name: 'Express', value: 'express' },
            { name: 'NestJS', value: 'nestjs' },
            { name: 'FastAPI', value: 'fastapi' },
            { name: 'Django', value: 'django' },
            { name: 'Spring Boot', value: 'springboot' }
          ],
          default: 'express'
        }
      ])
    ).backendType;

  let backendAnswers = {};

  if (backendType === 'express') {
    backendAnswers =
      typeof preset?.language === 'string'
        ? {
            language: preset.language,
            useMongo: Boolean(preset.useMongo)
          }
        : await inquirer.prompt([
            {
              type: 'list',
              name: 'language',
              message: 'Choose language:',
              choices: [
                { name: 'TypeScript (recommended)', value: 'TypeScript' },
                { name: 'JavaScript', value: 'JavaScript' }
              ],
              default: 'TypeScript'
            },
            {
              type: 'confirm',
              name: 'useMongo',
              message: 'Use MongoDB?',
              default: true
            }
          ]);
  }

  return {
    projectName,
    backendType: backendType as BackendConfig['backendType'],
    ...backendAnswers,
    destinationDir:
      typeof preset?.destinationDir === 'string'
        ? preset.destinationDir
        : undefined,
    packageManager:
      typeof preset?.packageManager === 'string'
        ? (preset.packageManager as BackendConfig['packageManager'])
        : undefined
  };
}
