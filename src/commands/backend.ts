import inquirer from 'inquirer';
import { buildBackend } from '../engine/backendBuilder.js';
import { BackendConfig } from '../types/backend-config.js';
import {
  hasFlag,
  inferPackageManager,
  readFlagValue
} from '../utils/cli-flags.js';

export async function backend(preset?: Record<string, unknown>) {
  try {
    const config = await resolveBackendConfig(preset);
    await buildBackend(config);
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
  const args = preset ? [] : process.argv.slice(3);
  const projectName =
    typeof preset?.projectName === 'string'
      ? preset.projectName
      : readFlagValue(args, '--name', '--project-name');
  let backendType =
    (typeof preset?.backendType === 'string'
      ? normalizeBackendType(preset.backendType)
      : undefined) ??
    normalizeBackendType(readFlagValue(args, '--framework', '--backend')) ??
    inferBackendTypeFromFlags(args);
  let language =
    (typeof preset?.language === 'string'
      ? normalizeLanguage(preset.language)
      : undefined) ??
    normalizeLanguage(readFlagValue(args, '--language')) ??
    inferLanguageFromFlags(args);
  let useMongo =
    typeof preset?.useMongo === 'boolean'
      ? preset.useMongo
      : inferMongoPreference(args);

  const resolvedProjectName =
    projectName ??
    (
      await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: 'Project name:'
        }
      ])
    ).projectName;

  if (!backendType) {
    backendType = (
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
  }

  let backendAnswers = {};

  if (backendType === 'express') {
    if (!language) {
      language = (
        await inquirer.prompt([
          {
            type: 'list',
            name: 'language',
            message: 'Choose language:',
            choices: [
              { name: 'TypeScript (recommended)', value: 'TypeScript' },
              { name: 'JavaScript', value: 'JavaScript' }
            ],
            default: 'TypeScript'
          }
        ])
      ).language;
    }

    if (typeof useMongo !== 'boolean') {
      useMongo = (
        await inquirer.prompt([
          {
            type: 'confirm',
            name: 'useMongo',
            message: 'Use MongoDB?',
            default: true
          }
        ])
      ).useMongo;
    }

    backendAnswers = { language, useMongo };
  }

  if (!backendType) {
    throw new Error('Backend type is required');
  }

  return {
    projectName: resolvedProjectName,
    backendType,
    ...backendAnswers,
    destinationDir:
      typeof preset?.destinationDir === 'string'
        ? preset.destinationDir
        : readFlagValue(
            args,
            '--destination',
            '--destination-dir',
            '--out-dir'
          ),
    packageManager:
      typeof preset?.packageManager === 'string'
        ? (preset.packageManager as BackendConfig['packageManager'])
        : inferPackageManager(args)
  };
}

function normalizeBackendType(
  value?: string
): BackendConfig['backendType'] | undefined {
  if (
    value === 'express' ||
    value === 'nestjs' ||
    value === 'fastapi' ||
    value === 'django' ||
    value === 'springboot'
  ) {
    return value;
  }

  return undefined;
}

function inferBackendTypeFromFlags(
  args: string[]
): BackendConfig['backendType'] | undefined {
  if (hasFlag(args, '--express')) {
    return 'express';
  }

  if (hasFlag(args, '--nestjs')) {
    return 'nestjs';
  }

  if (hasFlag(args, '--fastapi')) {
    return 'fastapi';
  }

  if (hasFlag(args, '--django')) {
    return 'django';
  }

  if (hasFlag(args, '--springboot', '--spring-boot')) {
    return 'springboot';
  }

  return undefined;
}

function normalizeLanguage(
  value?: string
): BackendConfig['language'] | undefined {
  if (value === 'TypeScript' || value === 'typescript') {
    return 'TypeScript';
  }

  if (value === 'JavaScript' || value === 'javascript') {
    return 'JavaScript';
  }

  return undefined;
}

function inferLanguageFromFlags(
  args: string[]
): BackendConfig['language'] | undefined {
  if (hasFlag(args, '--ts') && !hasFlag(args, '--js')) {
    return 'TypeScript';
  }

  if (hasFlag(args, '--js') && !hasFlag(args, '--ts')) {
    return 'JavaScript';
  }

  return undefined;
}

function inferMongoPreference(args: string[]) {
  if (hasFlag(args, '--mongo')) {
    return true;
  }

  if (hasFlag(args, '--no-mongo')) {
    return false;
  }

  const dbValue = readFlagValue(args, '--db');

  if (dbValue === 'mongo' || dbValue === 'mongodb') {
    return true;
  }

  if (dbValue === 'none') {
    return false;
  }

  return undefined;
}
