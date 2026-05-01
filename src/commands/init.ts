import fs from 'fs-extra';
import path from 'path';
import { buildBackend } from '../engine/builders/backendBuilder.js';
import { buildFrontend } from '../engine/builders/frontendBuilder.js';
import {
  bootstrapWorkspace,
  createWorkspaceRoot,
  wireMonorepoFrontend,
  wireWorkspaceApps,
  workspaceScope
} from '../engine/builders/monorepoBuilder.js';
import { runDoctor } from '../engine/doctor/index.js';
import { BackendConfig } from '../types/backend-config.js';
import { FrontendConfig } from '../types/frontend-config.js';
import {
  hasFlag,
  inferPackageManager,
  readFlagValue
} from '../utils/cli-flags.js';
import {
  printConfigurationSummary,
  printProjectIntro,
  SummaryEntry
} from '../utils/intro.js';
import {
  NavigableQuestion,
  promptWithNavigation,
  requireSelection
} from '../utils/prompt.js';

export async function init(preset?: Record<string, unknown>) {
  try {
    const parsedArgs = preset ? null : parseInitFlags(process.argv.slice(3));

    if (!preset) {
      printProjectIntro('Creating a new SetupForge project');
    }

    const { baseAnswers, frontendConfig, backendConfig } =
      await resolveInitAnswers(
        (preset?.baseAnswers as Partial<InitBaseAnswers> | undefined) ??
          parsedArgs?.baseAnswers,
        (preset?.frontendConfig as Partial<FrontendConfig> | null) ??
          parsedArgs?.frontendConfig,
        (preset?.backendConfig as Partial<BackendConfig> | null) ??
          parsedArgs?.backendConfig
      );

    if (!preset) {
      printConfigurationSummary(
        initConfigurationSummary(baseAnswers, frontendConfig, backendConfig)
      );
    }

    const useSingleStackRoot =
      !baseAnswers.useMonorepo && baseAnswers.stacks.length === 1;
    const rootDir = path.join(
      process.cwd(),
      useSingleStackRoot && frontendConfig
        ? frontendConfig.projectName
        : baseAnswers.projectName
    );

    if (await fs.pathExists(rootDir)) {
      throw new Error('Folder already exists');
    }

    runDoctor({
      packageManager: baseAnswers.packageManager,
      useMonorepo: baseAnswers.useMonorepo,
      frontendConfig,
      backendConfig
    });

    if (!useSingleStackRoot) {
      await fs.ensureDir(rootDir);
    }

    if (baseAnswers.useMonorepo) {
      await createWorkspaceRoot(
        rootDir,
        baseAnswers.packageManager,
        workspaceScope(baseAnswers.projectName)
      );
    }

    if (frontendConfig) {
      await buildFrontend({
        ...frontendConfig,
        destinationDir: baseAnswers.useMonorepo
          ? path.join(rootDir, 'apps')
          : useSingleStackRoot
            ? undefined
            : rootDir
      });

      if (baseAnswers.useMonorepo) {
        await wireMonorepoFrontend(
          rootDir,
          frontendConfig,
          workspaceScope(baseAnswers.projectName)
        );
      }
    }

    if (backendConfig) {
      await buildBackend({
        ...backendConfig,
        destinationDir: baseAnswers.useMonorepo
          ? path.join(rootDir, 'apps')
          : useSingleStackRoot
            ? undefined
            : rootDir
      });
    }

    if (baseAnswers.useMonorepo) {
      await wireWorkspaceApps(
        rootDir,
        workspaceScope(baseAnswers.projectName),
        Boolean(frontendConfig),
        Boolean(backendConfig)
      );
      await bootstrapWorkspace(rootDir, baseAnswers.packageManager);
    }

    console.log(`\n✅ Project setup complete at ${rootDir}\n`);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      console.log('\n❌ Operation cancelled by user\n');
      process.exit(0);
    }

    console.error('❌ Something went wrong:', error);
    process.exit(1);
  }
}

type InitBaseAnswers = {
  projectName: string;
  useMonorepo: boolean;
  packageManager: FrontendConfig['packageManager'];
  stacks: Array<'frontend' | 'backend'>;
};

type InitWizardAnswers = InitBaseAnswers & {
  frontendPlatform: FrontendConfig['platform'];
  frontendFramework: FrontendConfig['framework'];
  backendType: BackendConfig['backendType'];
  language: BackendConfig['language'];
  useMongo: BackendConfig['useMongo'];
};

type ParsedInitFlags = {
  baseAnswers: Partial<InitBaseAnswers>;
  frontendConfig: Partial<FrontendConfig> | null;
  backendConfig: Partial<BackendConfig> | null;
};

async function resolveInitAnswers(
  initial: Partial<InitBaseAnswers> = {},
  frontendPartial: Partial<FrontendConfig> | null = null,
  backendPartial: Partial<BackendConfig> | null = null
): Promise<{
  baseAnswers: InitBaseAnswers;
  frontendConfig: FrontendConfig | null;
  backendConfig: BackendConfig | null;
}> {
  const questions: Array<NavigableQuestion<InitWizardAnswers>> = [
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      when: () => !initial?.projectName
    },
    {
      type: 'confirm',
      name: 'useMonorepo',
      message: 'Use monorepo structure?',
      default: true,
      when: () => typeof initial?.useMonorepo !== 'boolean'
    },
    {
      type: 'list',
      name: 'packageManager',
      message: 'Choose your package manager:',
      choices: [
        { name: 'NPM', value: 'npm' },
        { name: 'PNPM', value: 'pnpm' },
        { name: 'YARN', value: 'yarn' },
        { name: 'BUN', value: 'bun' }
      ],
      default: 'npm',
      when: () => !initial?.packageManager
    },
    {
      type: 'checkbox',
      name: 'stacks',
      message: 'Choose stacks to setup:',
      choices: [
        { name: 'Frontend', value: 'frontend' },
        { name: 'Backend', value: 'backend' }
      ],
      validate: requireSelection,
      when: () => !initial?.stacks || initial.stacks.length === 0
    },
    {
      type: 'list',
      name: 'frontendPlatform',
      message: 'Choose frontend platform:',
      choices: [
        { name: 'Web 🌐', value: 'web' },
        { name: 'Native 📱', value: 'native' }
      ],
      when: (currentAnswers) =>
        currentAnswers.stacks.includes('frontend') && !frontendPartial?.platform
    },
    {
      type: 'list',
      name: 'frontendFramework',
      message: 'Choose frontend framework:',
      choices: (currentAnswers) =>
        currentAnswers.frontendPlatform === 'web'
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
      when: (currentAnswers) =>
        currentAnswers.stacks.includes('frontend') &&
        !frontendPartial?.framework
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
      when: (currentAnswers) =>
        currentAnswers.stacks.includes('backend') &&
        !backendPartial?.backendType
    },
    {
      type: 'list',
      name: 'language',
      message: 'Choose backend language:',
      choices: [
        { name: 'TypeScript (recommended)', value: 'TypeScript' },
        { name: 'JavaScript', value: 'JavaScript' }
      ],
      default: 'TypeScript',
      when: (currentAnswers) =>
        currentAnswers.stacks.includes('backend') &&
        currentAnswers.backendType === 'express' &&
        !backendPartial?.language
    },
    {
      type: 'confirm',
      name: 'useMongo',
      message: 'Use MongoDB?',
      default: true,
      when: (currentAnswers) =>
        currentAnswers.stacks.includes('backend') &&
        currentAnswers.backendType === 'express' &&
        typeof backendPartial?.useMongo !== 'boolean'
    }
  ];

  const answers = await promptWithNavigation<InitWizardAnswers>(questions, {
    ...initial,
    frontendPlatform: frontendPartial?.platform,
    frontendFramework: frontendPartial?.framework,
    backendType: backendPartial?.backendType,
    language: backendPartial?.language,
    useMongo: backendPartial?.useMongo
  });
  const baseAnswers = {
    projectName: answers.projectName,
    useMonorepo: answers.useMonorepo,
    packageManager: answers.packageManager,
    stacks: answers.stacks
  };
  const namingSeed = baseAnswers.useMonorepo
    ? '__monorepo__'
    : baseAnswers.stacks.length === 1
      ? baseAnswers.projectName
      : `${baseAnswers.projectName}__grouped__`;
  const frontendConfig = baseAnswers.stacks.includes('frontend')
    ? ({
        platform: answers.frontendPlatform,
        framework: answers.frontendFramework,
        projectName: frontendProjectDirName(
          namingSeed,
          answers.frontendPlatform
        ),
        packageManager: answers.packageManager
      } as FrontendConfig)
    : null;
  const backendConfig = baseAnswers.stacks.includes('backend')
    ? ({
        backendType: answers.backendType,
        language: answers.language,
        useMongo: answers.useMongo,
        projectName: backendProjectDirName(namingSeed),
        packageManager: answers.packageManager
      } as BackendConfig)
    : null;

  return {
    baseAnswers,
    frontendConfig,
    backendConfig
  };
}

function initConfigurationSummary(
  baseAnswers: InitBaseAnswers,
  frontendConfig: FrontendConfig | null,
  backendConfig: BackendConfig | null
): SummaryEntry[] {
  const entries: SummaryEntry[] = [
    { label: 'Project', value: baseAnswers.projectName },
    {
      label: 'Layout',
      value: baseAnswers.useMonorepo ? 'Monorepo' : 'Single project'
    },
    { label: 'Package manager', value: baseAnswers.packageManager ?? 'npm' },
    { label: 'Stacks', value: baseAnswers.stacks.join(', ') }
  ];

  if (frontendConfig) {
    entries.push({
      label: 'Frontend',
      value: `${frontendConfig.platform} / ${frontendConfig.framework}`
    });
  }

  if (backendConfig) {
    entries.push({
      label: 'Backend',
      value: backendConfig.backendType
    });

    if (backendConfig.backendType === 'express') {
      entries.push({
        label: 'Backend options',
        value: `${backendConfig.language ?? 'TypeScript'}, MongoDB ${backendConfig.useMongo ? 'enabled' : 'skipped'}`
      });
    }
  }

  return entries;
}

function frontendProjectDirName(
  projectName: string,
  platform: FrontendConfig['platform']
): string {
  return projectName === '__monorepo__'
    ? platform === 'native'
      ? 'mobile'
      : 'web'
    : projectName.endsWith('__grouped__')
      ? platform === 'native'
        ? `${toNativeProjectName(projectName.replace(/__grouped__$/, ''))}Mobile`
        : `${projectName.replace(/__grouped__$/, '')}-frontend`
      : platform === 'native'
        ? toNativeProjectName(projectName)
        : projectName;
}

function backendProjectDirName(projectName: string): string {
  return projectName === '__monorepo__'
    ? 'api'
    : projectName.endsWith('__grouped__')
      ? `${projectName.replace(/__grouped__$/, '')}-backend`
      : projectName;
}

function toNativeProjectName(projectName: string): string {
  const normalized = projectName
    .replace(/^[^a-zA-Z]+/, '')
    .replace(/[^a-zA-Z0-9]+([a-zA-Z0-9])/g, (_, value: string) =>
      value.toUpperCase()
    )
    .replace(/[^a-zA-Z0-9]/g, '');

  return normalized || 'MobileApp';
}

function parseInitFlags(args: string[]): ParsedInitFlags {
  const packageManager = inferPackageManager(args);
  const projectName = readFlagValue(args, '--name', '--project-name');
  const useMonorepo = hasFlag(args, '--monorepo')
    ? true
    : hasFlag(args, '--no-monorepo')
      ? false
      : undefined;
  const stacks = inferStacks(args);
  const frontendFramework = inferInitFrontendFramework(args);
  const backendType = inferInitBackendType(args);
  const frontendPlatform =
    frontendFramework === 'expo' || frontendFramework === 'react-native'
      ? 'native'
      : frontendFramework
        ? 'web'
        : inferInitFrontendPlatform(args);

  return {
    baseAnswers: {
      projectName,
      useMonorepo,
      packageManager,
      stacks
    },
    frontendConfig:
      frontendFramework || frontendPlatform
        ? {
            platform: frontendPlatform,
            framework: frontendFramework,
            packageManager
          }
        : null,
    backendConfig:
      backendType ||
      inferInitLanguage(args) ||
      typeof inferInitMongoPreference(args) === 'boolean'
        ? {
            backendType,
            language: inferInitLanguage(args),
            useMongo: inferInitMongoPreference(args),
            packageManager
          }
        : null
  };
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

  if (stacks.length > 0) {
    return stacks;
  }

  return undefined;
}

function inferInitFrontendPlatform(
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

function inferInitFrontendFramework(
  args: string[]
): FrontendConfig['framework'] | undefined {
  const value = readFlagValue(args, '--frontend-framework', '--framework');

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

function inferInitBackendType(
  args: string[]
): BackendConfig['backendType'] | undefined {
  const value = readFlagValue(args, '--backend-framework', '--framework');

  if (
    value === 'express' ||
    value === 'nestjs' ||
    value === 'fastapi' ||
    value === 'django' ||
    value === 'springboot'
  ) {
    return value;
  }

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

function inferInitLanguage(
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

function inferInitMongoPreference(args: string[]) {
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
