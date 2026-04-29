import { runDoctor } from '../engine/doctor/index.js';
import { buildFrontend } from '../engine/frontendBuilder.js';
import { FrontendConfig } from '../types/frontend-config.js';
import {
  hasFlag,
  inferPackageManager,
  readFlagValue
} from '../utils/cli-flags.js';
import { promptWithNavigation } from '../utils/prompt.js';

export async function frontend(preset?: Record<string, unknown>) {
  try {
    const config = await resolveFrontendConfig(preset);
    runDoctor({
      packageManager: config.packageManager,
      frontendConfig: config
    });
    await buildFrontend(config);
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
  const args = preset ? [] : process.argv.slice(3);
  let platform =
    (typeof preset?.platform === 'string'
      ? normalizePlatform(preset.platform)
      : undefined) ??
    normalizePlatform(readFlagValue(args, '--platform')) ??
    inferPlatformFromFlags(args);
  let framework =
    (typeof preset?.framework === 'string'
      ? normalizeFramework(preset.framework)
      : undefined) ??
    normalizeFramework(readFlagValue(args, '--framework')) ??
    inferFrameworkFromFlags(args);
  const projectName =
    typeof preset?.projectName === 'string'
      ? preset.projectName
      : readFlagValue(args, '--name', '--project-name');
  const destinationDir =
    typeof preset?.destinationDir === 'string'
      ? preset.destinationDir
      : readFlagValue(args, '--destination', '--destination-dir', '--out-dir');
  const packageManager =
    typeof preset?.packageManager === 'string'
      ? preset.packageManager
      : inferPackageManager(args);

  if (!platform && framework) {
    platform =
      framework === 'expo' || framework === 'react-native' ? 'native' : 'web';
  }

  if (platform && framework && !isFrameworkCompatible(platform, framework)) {
    throw new Error(
      `Framework "${framework}" is not valid for platform "${platform}"`
    );
  }

  const answers = await promptWithNavigation<FrontendConfig>(
    [
      {
        type: 'list',
        name: 'platform',
        message: 'Choose platform:',
        choices: [
          { name: 'Web 🌐', value: 'web' },
          { name: 'Native 📱', value: 'native' }
        ],
        when: () => !platform
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Choose framework:',
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
      },
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        when: () => !projectName
      }
    ],
    {
      platform,
      framework,
      projectName,
      destinationDir,
      packageManager:
        typeof packageManager === 'string'
          ? (packageManager as FrontendConfig['packageManager'])
          : undefined
    }
  );

  platform = answers.platform;
  framework = answers.framework;
  const resolvedProjectName = answers.projectName;

  if (!platform || !framework) {
    throw new Error('Frontend platform and framework are required');
  }

  return {
    platform,
    framework,
    projectName: resolvedProjectName,
    destinationDir,
    packageManager:
      typeof packageManager === 'string'
        ? (packageManager as FrontendConfig['packageManager'])
        : undefined
  };
}

function normalizePlatform(
  value?: string
): FrontendConfig['platform'] | undefined {
  if (value === 'web' || value === 'native') {
    return value;
  }

  return undefined;
}

function normalizeFramework(
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

function inferPlatformFromFlags(
  args: string[]
): FrontendConfig['platform'] | undefined {
  if (hasFlag(args, '--web') && !hasFlag(args, '--native')) {
    return 'web';
  }

  if (hasFlag(args, '--native') && !hasFlag(args, '--web')) {
    return 'native';
  }

  return undefined;
}

function inferFrameworkFromFlags(
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

function isFrameworkCompatible(
  platform: FrontendConfig['platform'],
  framework: FrontendConfig['framework']
) {
  if (platform === 'web') {
    return ['next', 'angular', 'vue', 'vite'].includes(framework);
  }

  return ['expo', 'react-native'].includes(framework);
}
