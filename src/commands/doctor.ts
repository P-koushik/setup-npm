import fs from 'fs-extra';
import path from 'path';
import { DoctorConfig, runDoctor } from '../engine/doctor/index.js';
import { BackendConfig } from '../types/backend-config.js';
import { FrontendConfig } from '../types/frontend-config.js';
import {
  hasFlag,
  inferPackageManager,
  readFlagValue
} from '../utils/cli-flags.js';
import { promptWithNavigation, requireSelection } from '../utils/prompt.js';

type DoctorAnswers = {
  packageManager: NonNullable<FrontendConfig['packageManager']>;
  useMonorepo: boolean;
  stacks: Array<'frontend' | 'backend'>;
};

export async function doctor(preset?: Record<string, unknown>) {
  try {
    const args = preset ? [] : process.argv.slice(3);
    const detectedConfig = preset
      ? null
      : await detectInitializedProject(process.cwd(), args);

    if (detectedConfig) {
      runDoctor(detectedConfig);
      return;
    }

    const baseAnswers = await resolveDoctorAnswers(args, preset);
    const frontendConfig = baseAnswers.stacks.includes('frontend')
      ? await resolveFrontendConfig(args, baseAnswers.packageManager, preset)
      : null;
    const backendConfig = baseAnswers.stacks.includes('backend')
      ? await resolveBackendConfig(args, baseAnswers.packageManager, preset)
      : null;

    runDoctor({
      packageManager: baseAnswers.packageManager,
      useMonorepo: baseAnswers.useMonorepo,
      frontendConfig,
      backendConfig
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      console.log('\n❌ Operation cancelled by user\n');
      process.exit(0);
    }

    if (error instanceof Error) {
      console.error(`❌ ${error.message}`);
    } else {
      console.error('❌ Something went wrong:', error);
    }

    process.exit(1);
  }
}

async function detectInitializedProject(
  cwd: string,
  args: string[]
): Promise<DoctorConfig | null> {
  if (args.length > 0) {
    return null;
  }

  const hasRootPom = await fs.pathExists(path.join(cwd, 'pom.xml'));

  if (hasRootPom) {
    return {
      backendConfig: {
        backendType: 'springboot',
        projectName: path.basename(cwd)
      }
    };
  }

  const appsDir = path.join(cwd, 'apps');

  if (!(await fs.pathExists(appsDir))) {
    return null;
  }

  const appNames = await fs.readdir(appsDir);
  const springBootApp = appNames.find((appName) =>
    fs.existsSync(path.join(appsDir, appName, 'pom.xml'))
  );

  if (!springBootApp) {
    return null;
  }

  return {
    packageManager: await detectPackageManager(cwd),
    useMonorepo: true,
    backendConfig: {
      backendType: 'springboot',
      projectName: springBootApp
    }
  };
}

async function detectPackageManager(
  cwd: string
): Promise<NonNullable<FrontendConfig['packageManager']>> {
  if (await fs.pathExists(path.join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }

  if (await fs.pathExists(path.join(cwd, 'yarn.lock'))) {
    return 'yarn';
  }

  if (await fs.pathExists(path.join(cwd, 'bun.lockb'))) {
    return 'bun';
  }

  if (await fs.pathExists(path.join(cwd, 'bun.lock'))) {
    return 'bun';
  }

  return 'npm';
}

async function resolveDoctorAnswers(
  args: string[],
  preset?: Record<string, unknown>
): Promise<DoctorAnswers> {
  const resolvedPackageManager =
    (typeof preset?.packageManager === 'string'
      ? (preset.packageManager as FrontendConfig['packageManager'])
      : undefined) ?? inferPackageManager(args);
  const resolvedUseMonorepo =
    typeof preset?.useMonorepo === 'boolean'
      ? preset.useMonorepo
      : hasFlag(args, '--monorepo')
        ? true
        : hasFlag(args, '--no-monorepo')
          ? false
          : undefined;
  const resolvedStacks = resolvePresetStacks(preset) ?? inferStacks(args);
  const answers = await promptWithNavigation<DoctorAnswers>(
    [
      {
        type: 'list',
        name: 'packageManager',
        message: 'Choose package manager:',
        choices: [
          { name: 'npm', value: 'npm' },
          { name: 'pnpm', value: 'pnpm' },
          { name: 'yarn', value: 'yarn' },
          { name: 'bun', value: 'bun' }
        ],
        default: 'npm',
        when: () => !resolvedPackageManager
      },
      {
        type: 'confirm',
        name: 'useMonorepo',
        message: 'Use monorepo structure?',
        default: true,
        when: () => typeof resolvedUseMonorepo !== 'boolean'
      },
      {
        type: 'checkbox',
        name: 'stacks',
        message: 'Choose stacks to check:',
        choices: [
          { name: 'Frontend', value: 'frontend' },
          { name: 'Backend', value: 'backend' }
        ],
        validate: requireSelection,
        when: () => !resolvedStacks
      }
    ],
    {
      packageManager: resolvedPackageManager,
      useMonorepo: resolvedUseMonorepo,
      stacks: resolvedStacks
    }
  );

  return {
    packageManager: answers.packageManager ?? 'npm',
    useMonorepo: answers.useMonorepo,
    stacks: answers.stacks
  };
}

async function resolveFrontendConfig(
  args: string[],
  packageManager: FrontendConfig['packageManager'],
  preset?: Record<string, unknown>
): Promise<FrontendConfig> {
  let platform =
    normalizePlatform(
      typeof preset?.platform === 'string' ? preset.platform : undefined
    ) ??
    normalizePlatform(readFlagValue(args, '--platform')) ??
    inferPlatform(args);
  let framework =
    normalizeFrontendFramework(
      typeof preset?.framework === 'string' ? preset.framework : undefined
    ) ??
    normalizeFrontendFramework(
      readFlagValue(args, '--frontend-framework', '--framework')
    ) ??
    inferFrontendFramework(args);

  if (!platform && framework) {
    platform =
      framework === 'expo' || framework === 'react-native' ? 'native' : 'web';
  }

  const answers = await promptWithNavigation<FrontendConfig>(
    [
      {
        type: 'list',
        name: 'platform',
        message: 'Choose frontend platform:',
        choices: [
          { name: 'Web 🌐', value: 'web' },
          { name: 'Native 📱', value: 'native' }
        ],
        when: () => !platform
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Choose frontend framework:',
        choices: (currentAnswers) =>
          currentAnswers.platform === 'web'
            ? [
                { name: 'Next.js (recommended)', value: 'next' },
                { name: 'Angular', value: 'angular' },
                { name: 'Vue', value: 'vue' },
                { name: 'React (Vite)', value: 'vite' }
              ]
            : [
                { name: 'Expo (recommended)', value: 'expo' },
                { name: 'React Native CLI', value: 'react-native' }
              ],
        when: () => !framework
      }
    ],
    {
      platform,
      framework,
      projectName: 'doctor-check',
      packageManager
    }
  );

  platform = answers.platform;
  framework = answers.framework;

  if (!platform || !framework) {
    throw new Error('Frontend platform and framework are required');
  }

  return {
    platform,
    framework,
    projectName: 'doctor-check',
    packageManager
  };
}

async function resolveBackendConfig(
  args: string[],
  packageManager: BackendConfig['packageManager'],
  preset?: Record<string, unknown>
): Promise<BackendConfig> {
  const backendType =
    normalizeBackendType(
      typeof preset?.backendType === 'string' ? preset.backendType : undefined
    ) ??
    normalizeBackendType(
      readFlagValue(args, '--backend-framework', '--backend')
    ) ??
    inferBackendType(args);
  const answers = await promptWithNavigation<BackendConfig>(
    [
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
      }
    ],
    {
      backendType,
      projectName: 'doctor-check',
      packageManager
    }
  );

  return {
    backendType: answers.backendType,
    projectName: 'doctor-check',
    packageManager
  };
}

function resolvePresetStacks(
  preset?: Record<string, unknown>
): Array<'frontend' | 'backend'> | undefined {
  if (!Array.isArray(preset?.stacks)) {
    return undefined;
  }

  const stacks = preset.stacks.filter(
    (stack): stack is 'frontend' | 'backend' =>
      stack === 'frontend' || stack === 'backend'
  );

  return stacks.length > 0 ? stacks : undefined;
}

function inferStacks(
  args: string[]
): Array<'frontend' | 'backend'> | undefined {
  const stacks: Array<'frontend' | 'backend'> = [];

  if (hasFlag(args, '--frontend')) {
    stacks.push('frontend');
  }

  if (hasFlag(args, '--backend')) {
    stacks.push('backend');
  }

  return stacks.length > 0 ? stacks : undefined;
}

function normalizePlatform(
  value?: string
): FrontendConfig['platform'] | undefined {
  if (value === 'web' || value === 'native') {
    return value;
  }

  return undefined;
}

function normalizeFrontendFramework(
  value?: string
): FrontendConfig['framework'] | undefined {
  if (
    value === 'next' ||
    value === 'angular' ||
    value === 'vue' ||
    value === 'vite' ||
    value === 'expo' ||
    value === 'react-native'
  ) {
    return value;
  }

  return undefined;
}

function inferPlatform(args: string[]): FrontendConfig['platform'] | undefined {
  if (hasFlag(args, '--web') && !hasFlag(args, '--native')) {
    return 'web';
  }

  if (hasFlag(args, '--native') && !hasFlag(args, '--web')) {
    return 'native';
  }

  return undefined;
}

function inferFrontendFramework(
  args: string[]
): FrontendConfig['framework'] | undefined {
  if (hasFlag(args, '--next')) {
    return 'next';
  }

  if (hasFlag(args, '--angular')) {
    return 'angular';
  }

  if (hasFlag(args, '--vue')) {
    return 'vue';
  }

  if (hasFlag(args, '--vite')) {
    return 'vite';
  }

  if (hasFlag(args, '--expo')) {
    return 'expo';
  }

  if (hasFlag(args, '--react-native')) {
    return 'react-native';
  }

  return undefined;
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

function inferBackendType(
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
