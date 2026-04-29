import { buildBackend } from '../engine/backendBuilder.js';
import { runDoctor } from '../engine/doctor/index.js';
import { BackendConfig } from '../types/backend-config.js';
import {
  hasFlag,
  inferPackageManager,
  readFlagValue
} from '../utils/cli-flags.js';
import { promptWithNavigation } from '../utils/prompt.js';

export async function backend(preset?: Record<string, unknown>) {
  try {
    const config = await resolveBackendConfig(preset);
    runDoctor({
      packageManager: config.packageManager,
      backendConfig: config
    });
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
  const language =
    (typeof preset?.language === 'string'
      ? normalizeLanguage(preset.language)
      : undefined) ??
    normalizeLanguage(readFlagValue(args, '--language')) ??
    inferLanguageFromFlags(args);
  const useMongo =
    typeof preset?.useMongo === 'boolean'
      ? preset.useMongo
      : inferMongoPreference(args);

  const answers = await promptWithNavigation<BackendConfig>(
    [
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        when: () => !projectName
      },
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
        default: 'express',
        when: () => !backendType
      },
      {
        type: 'list',
        name: 'language',
        message: 'Choose language:',
        choices: [
          { name: 'TypeScript (recommended)', value: 'TypeScript' },
          { name: 'JavaScript', value: 'JavaScript' }
        ],
        default: 'TypeScript',
        when: (currentAnswers) =>
          currentAnswers.backendType === 'express' && !language
      },
      {
        type: 'confirm',
        name: 'useMongo',
        message: 'Use MongoDB?',
        default: true,
        when: (currentAnswers) =>
          currentAnswers.backendType === 'express' &&
          typeof useMongo !== 'boolean'
      }
    ],
    {
      projectName,
      backendType,
      language,
      useMongo,
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
    }
  );

  backendType = answers.backendType;

  if (!backendType) {
    throw new Error('Backend type is required');
  }

  return {
    projectName: answers.projectName,
    backendType,
    language: answers.language,
    useMongo: answers.useMongo,
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
