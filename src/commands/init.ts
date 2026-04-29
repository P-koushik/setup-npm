import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { buildBackend } from '../engine/backendBuilder.js';
import { runDoctor } from '../engine/doctor/index.js';
import { buildFrontend } from '../engine/frontendBuilder.js';
import { BackendConfig } from '../types/backend-config.js';
import { FrontendConfig } from '../types/frontend-config.js';
import {
  hasFlag,
  inferPackageManager,
  readFlagValue
} from '../utils/cli-flags.js';
import { promptWithNavigation, requireSelection } from '../utils/prompt.js';

export async function init(preset?: Record<string, unknown>) {
  try {
    const parsedArgs = preset ? null : parseInitFlags(process.argv.slice(3));
    const { baseAnswers, frontendConfig, backendConfig } =
      await resolveInitAnswers(
        (preset?.baseAnswers as Partial<InitBaseAnswers> | undefined) ??
          parsedArgs?.baseAnswers,
        (preset?.frontendConfig as Partial<FrontendConfig> | null) ??
          parsedArgs?.frontendConfig,
        (preset?.backendConfig as Partial<BackendConfig> | null) ??
          parsedArgs?.backendConfig
      );

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
  const answers = await promptWithNavigation<InitWizardAnswers>(
    [
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
        message: 'Choose package manager:',
        choices: [
          { name: 'npm', value: 'npm' },
          { name: 'pnpm', value: 'pnpm' },
          { name: 'yarn', value: 'yarn' },
          { name: 'bun', value: 'bun' }
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
          currentAnswers.stacks.includes('frontend') &&
          !frontendPartial?.platform
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
    ],
    {
      ...initial,
      frontendPlatform: frontendPartial?.platform,
      frontendFramework: frontendPartial?.framework,
      backendType: backendPartial?.backendType,
      language: backendPartial?.language,
      useMongo: backendPartial?.useMongo
    }
  );
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

async function createWorkspaceRoot(
  rootDir: string,
  packageManager: FrontendConfig['packageManager'],
  scope: string
) {
  const resolvedPackageManager = packageManager ?? 'npm';
  await fs.ensureDir(path.join(rootDir, 'apps'));
  await fs.ensureDir(path.join(rootDir, 'packages', 'eslint-config'));
  await fs.ensureDir(path.join(rootDir, 'packages', 'typescript-config'));
  await fs.ensureDir(path.join(rootDir, 'packages', 'types', 'src'));
  await fs.ensureDir(path.join(rootDir, 'packages', 'models', 'src'));

  const rootPackageJson: Record<string, unknown> = {
    name: path.basename(rootDir),
    private: true,
    packageManager: workspacePackageManagerSpec(resolvedPackageManager),
    scripts: {
      build: 'turbo run build',
      dev: 'turbo dev',
      lint: 'turbo run lint',
      typecheck: 'turbo run typecheck'
    },
    devDependencies: {
      turbo: '^2.0.0'
    }
  };

  if (resolvedPackageManager !== 'pnpm') {
    rootPackageJson.workspaces = ['apps/*', 'packages/*'];
  }

  await fs.writeJson(path.join(rootDir, 'package.json'), rootPackageJson, {
    spaces: 2
  });

  if (resolvedPackageManager === 'pnpm') {
    await fs.writeFile(
      path.join(rootDir, 'pnpm-workspace.yaml'),
      `packages:
  - apps/*
  - packages/*
`
    );
  }

  await fs.writeJson(
    path.join(rootDir, 'turbo.json'),
    {
      $schema: 'https://turbo.build/schema.json',
      ui: 'tui',
      noUpdateNotifier: true,
      tasks: {
        build: {
          dependsOn: ['^build'],
          outputs: ['dist/**', '.next/**', 'build/**']
        },
        dev: {
          dependsOn: ['^build'],
          cache: false,
          persistent: true
        },
        lint: {
          dependsOn: ['^lint']
        },
        typecheck: {
          dependsOn: ['^typecheck']
        }
      }
    },
    { spaces: 2 }
  );

  await fs.writeFile(
    path.join(rootDir, '.gitignore'),
    `node_modules
.turbo
dist
build
.next
.env
`
  );

  await fs.writeJson(
    path.join(rootDir, 'packages', 'eslint-config', 'package.json'),
    {
      name: '@repo/eslint-config',
      version: '0.0.0',
      private: true,
      type: 'module',
      exports: {
        '.': './base.mjs'
      }
    },
    { spaces: 2 }
  );

  await fs.writeFile(
    path.join(rootDir, 'packages', 'eslint-config', 'base.mjs'),
    `import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist', 'build', 'coverage', 'node_modules']
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      globals: globals.node
    }
  },
  prettier
];
`
  );

  await fs.writeJson(
    path.join(rootDir, 'packages', 'typescript-config', 'package.json'),
    {
      name: '@repo/typescript-config',
      version: '0.0.0',
      private: true
    },
    { spaces: 2 }
  );

  await fs.writeJson(
    path.join(rootDir, 'packages', 'typescript-config', 'base.json'),
    {
      $schema: 'https://json.schemastore.org/tsconfig',
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        skipLibCheck: true
      }
    },
    { spaces: 2 }
  );

  await fs.writeJson(
    path.join(rootDir, 'packages', 'types', 'package.json'),
    {
      name: `@${scope}/types`,
      version: '0.0.0',
      private: true,
      type: 'module',
      main: './dist/index.js',
      types: './dist/index.d.ts',
      exports: {
        '.': {
          types: './dist/index.d.ts',
          default: './dist/index.js'
        },
        './*': {
          types: './dist/*.d.ts',
          default: './dist/*.js'
        }
      },
      scripts: {
        build: 'tsc -p tsconfig.json',
        lint: 'echo "No lint configured for shared types"',
        typecheck: 'tsc --noEmit'
      },
      devDependencies: {
        typescript: '^6.0.2'
      }
    },
    { spaces: 2 }
  );

  await fs.writeJson(
    path.join(rootDir, 'packages', 'types', 'tsconfig.json'),
    {
      extends: '../typescript-config/base.json',
      compilerOptions: {
        outDir: 'dist',
        rootDir: 'src',
        declaration: true,
        emitDeclarationOnly: false
      },
      include: ['src']
    },
    { spaces: 2 }
  );

  await fs.writeFile(
    path.join(rootDir, 'packages', 'types', 'src', 'user.ts'),
    `export interface User {
  id: string;
  email: string;
  name: string;
}
`
  );

  await fs.writeFile(
    path.join(rootDir, 'packages', 'types', 'src', 'api-response.ts'),
    `export interface ApiResponse<T> {
  data: T;
  message: string;
}
`
  );

  await fs.writeFile(
    path.join(rootDir, 'packages', 'types', 'src', 'index.ts'),
    `export * from './user.js';
export * from './api-response.js';
`
  );

  await fs.writeJson(
    path.join(rootDir, 'packages', 'models', 'package.json'),
    {
      name: `@${scope}/models`,
      version: '0.0.0',
      private: true,
      type: 'module',
      main: './dist/index.js',
      types: './dist/index.d.ts',
      exports: {
        '.': {
          types: './dist/index.d.ts',
          default: './dist/index.js'
        },
        './*': {
          types: './dist/*.d.ts',
          default: './dist/*.js'
        }
      },
      scripts: {
        build: 'tsc -p tsconfig.json',
        lint: 'echo "No lint configured for shared models"',
        typecheck: 'tsc --noEmit'
      },
      dependencies: {
        [`@${scope}/types`]: '*'
      },
      devDependencies: {
        typescript: '^6.0.2'
      }
    },
    { spaces: 2 }
  );

  await fs.writeJson(
    path.join(rootDir, 'packages', 'models', 'tsconfig.json'),
    {
      extends: '../typescript-config/base.json',
      compilerOptions: {
        outDir: 'dist',
        rootDir: 'src',
        declaration: true,
        emitDeclarationOnly: false
      },
      include: ['src']
    },
    { spaces: 2 }
  );

  await fs.writeFile(
    path.join(rootDir, 'packages', 'models', 'src', 'user-model.ts'),
    `import type { User } from '@${scope}/types/user';

export const emptyUser = (): User => ({
  id: '',
  email: '',
  name: ''
});
`
  );

  await fs.writeFile(
    path.join(rootDir, 'packages', 'models', 'src', 'index.ts'),
    `export * from './user-model.js';
`
  );
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

async function bootstrapWorkspace(
  rootDir: string,
  packageManager: FrontendConfig['packageManager']
) {
  const resolvedPackageManager = packageManager ?? 'npm';
  const command = installCommand(resolvedPackageManager);

  console.log('\n▶ Bootstrapping monorepo dependencies');
  console.log(`$ cd ${rootDir} && ${command}\n`);

  execSync(command, {
    cwd: rootDir,
    stdio: 'inherit'
  });
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

async function wireWorkspaceApps(
  rootDir: string,
  scope: string,
  hasFrontend: boolean,
  hasBackend: boolean
) {
  if (hasFrontend) {
    await addWorkspaceDependencies(
      path.join(rootDir, 'apps', 'web', 'package.json'),
      {
        name: 'web',
        dependencies: {
          [`@${scope}/types`]: '*',
          [`@${scope}/models`]: '*'
        }
      }
    );
  }

  if (hasBackend) {
    await addWorkspaceDependencies(
      path.join(rootDir, 'apps', 'api', 'package.json'),
      {
        name: 'api',
        dependencies: {
          [`@${scope}/types`]: '*',
          [`@${scope}/models`]: '*'
        }
      }
    );
  }
}

async function wireMonorepoFrontend(
  rootDir: string,
  frontendConfig: FrontendConfig,
  scope: string
) {
  const webDirName = frontendConfig.projectName;
  const webDir = path.join(rootDir, 'apps', webDirName);

  await addWorkspaceDependencies(path.join(webDir, 'package.json'), {
    name: 'web',
    dependencies: {
      [`@${scope}/types`]: '*',
      [`@${scope}/models`]: '*'
    }
  });

  if (frontendConfig.framework === 'next') {
    await fs.writeFile(
      path.join(webDir, 'next.config.ts'),
      `import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(process.cwd(), '../..')
  }
};

export default nextConfig;
`
    );
  }
}

async function addWorkspaceDependencies(
  packageJsonPath: string,
  values: {
    name: string;
    dependencies: Record<string, string>;
  }
) {
  if (!(await fs.pathExists(packageJsonPath))) {
    return;
  }

  const packageJson = (await fs.readJson(packageJsonPath)) as {
    name?: string;
    dependencies?: Record<string, string>;
  };

  packageJson.name = values.name;
  packageJson.dependencies ||= {};

  for (const [dependency, version] of Object.entries(values.dependencies)) {
    if (!packageJson.dependencies[dependency]) {
      packageJson.dependencies[dependency] = version;
    }
  }

  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
}

function workspaceScope(projectName: string): string {
  const normalized = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'repo';
}

function workspacePackageManagerSpec(
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
): string {
  switch (packageManager) {
    case 'npm':
      return 'npm@10.9.0';
    case 'pnpm':
      return 'pnpm@9.15.0';
    case 'yarn':
      return 'yarn@1.22.22';
    case 'bun':
      return 'bun@1.1.38';
  }
}
