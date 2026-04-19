import { execSync } from 'child_process';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import path from 'path';
import { buildBackend } from '../engine/backendBuilder.js';
import { buildFrontend } from '../engine/frontendBuilder.js';
import { BackendConfig } from '../types/backend-config.js';
import { FrontendConfig } from '../types/frontend-config.js';
import {
  beginRun,
  clearRun,
  completeStep,
  failStep,
  loadState,
  updateProjectConfig
} from '../utils/state.js';

export async function init(preset?: Record<string, unknown>) {
  try {
    const baseAnswers = preset?.baseAnswers
      ? (preset.baseAnswers as Record<string, unknown>)
      : await inquirer.prompt([
          {
            type: 'input',
            name: 'projectName',
            message: 'Project name:',
            validate: (input: string) =>
              input ? true : 'Project name is required'
          },
          {
            type: 'confirm',
            name: 'useMonorepo',
            message: 'Use monorepo structure?',
            default: true
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
            default: 'npm'
          },
          {
            type: 'checkbox',
            name: 'stacks',
            message: 'Choose stacks to setup:',
            choices: [
              { name: 'Frontend', value: 'frontend' },
              { name: 'Backend', value: 'backend' }
            ],
            validate: (input: string[]) =>
              input.length > 0 ? true : 'Select at least one stack'
          }
        ]);

    let frontendConfig: FrontendConfig | null =
      (preset?.frontendConfig as FrontendConfig | null) ?? null;
    let backendConfig: BackendConfig | null =
      (preset?.backendConfig as BackendConfig | null) ?? null;
    const namingSeed = baseAnswers.useMonorepo
      ? '__monorepo__'
      : baseAnswers.projectName;

    if (!frontendConfig && baseAnswers.stacks.includes('frontend')) {
      frontendConfig = await askFrontendConfig(
        namingSeed,
        baseAnswers.packageManager
      );
    }

    if (!backendConfig && baseAnswers.stacks.includes('backend')) {
      backendConfig = await askBackendConfig(
        namingSeed,
        baseAnswers.packageManager
      );
    }

    validateMonorepoSelection(baseAnswers.useMonorepo, backendConfig);

    const rootDir = path.join(process.cwd(), baseAnswers.projectName);

    if (await fs.pathExists(rootDir)) {
      throw new Error('Folder already exists');
    }

    await fs.ensureDir(rootDir);
    const existingState = await loadState(rootDir);

    if (!existingState) {
      await beginRun(rootDir, {
        command: 'init',
        projectPath: rootDir,
        input: {
          baseAnswers,
          frontendConfig,
          backendConfig
        },
        steps: [
          { id: 'create-workspace-root', status: 'pending' },
          { id: 'scaffold-frontend', status: 'pending' },
          { id: 'scaffold-backend', status: 'pending' },
          { id: 'bootstrap-workspace', status: 'pending' }
        ]
      });
    }

    if (baseAnswers.useMonorepo) {
      try {
        if (
          !existingState?.steps.some(
            (step) =>
              step.id === 'create-workspace-root' && step.status === 'completed'
          )
        ) {
          await createWorkspaceRoot(
            rootDir,
            baseAnswers.packageManager,
            workspaceScope(baseAnswers.projectName)
          );
          await completeStep(rootDir, 'create-workspace-root');
        }
      } catch {
        await failStep(rootDir, 'create-workspace-root');
        throw new Error('Workspace root creation failed');
      }
    }

    if (frontendConfig) {
      try {
        if (
          !existingState?.steps.some(
            (step) =>
              step.id === 'scaffold-frontend' && step.status === 'completed'
          )
        ) {
          await buildFrontend({
            ...frontendConfig,
            destinationDir: baseAnswers.useMonorepo
              ? path.join(rootDir, 'apps')
              : rootDir
          });

          if (baseAnswers.useMonorepo) {
            await wireMonorepoFrontend(
              rootDir,
              frontendConfig,
              workspaceScope(baseAnswers.projectName)
            );
          }
          await completeStep(rootDir, 'scaffold-frontend');
        }
      } catch {
        await failStep(rootDir, 'scaffold-frontend');
        throw new Error('Frontend scaffolding failed');
      }
    }

    if (backendConfig) {
      try {
        if (
          !existingState?.steps.some(
            (step) =>
              step.id === 'scaffold-backend' && step.status === 'completed'
          )
        ) {
          await buildBackend({
            ...backendConfig,
            destinationDir: baseAnswers.useMonorepo
              ? path.join(rootDir, 'apps')
              : rootDir
          });
          await completeStep(rootDir, 'scaffold-backend');
        }
      } catch {
        await failStep(rootDir, 'scaffold-backend');
        throw new Error('Backend scaffolding failed');
      }
    }

    if (baseAnswers.useMonorepo) {
      try {
        if (
          !existingState?.steps.some(
            (step) =>
              step.id === 'bootstrap-workspace' && step.status === 'completed'
          )
        ) {
          await wireWorkspaceApps(
            rootDir,
            workspaceScope(baseAnswers.projectName),
            Boolean(frontendConfig),
            Boolean(backendConfig)
          );
          bootstrapWorkspace(rootDir, baseAnswers.packageManager);
          await completeStep(rootDir, 'bootstrap-workspace');
        }
      } catch {
        await failStep(rootDir, 'bootstrap-workspace');
        throw new Error('Workspace bootstrap failed');
      }
    }

    await updateProjectConfig(rootDir, {
      projectName: baseAnswers.projectName,
      monorepo: baseAnswers.useMonorepo,
      packageManager: baseAnswers.packageManager,
      frontend: frontendConfig?.framework,
      backend: backendConfig?.backendType
    });
    await clearRun(rootDir);

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

async function askFrontendConfig(
  projectName: string,
  packageManager: FrontendConfig['packageManager']
): Promise<FrontendConfig> {
  const { platform } = await inquirer.prompt([
    {
      type: 'list',
      name: 'platform',
      message: 'Choose frontend platform:',
      choices: [
        { name: 'Web 🌐', value: 'web' },
        { name: 'Native 📱', value: 'native' }
      ]
    }
  ]);

  const frameworkChoices =
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
        ];

  const { framework } = await inquirer.prompt([
    {
      type: 'list',
      name: 'framework',
      message: 'Choose frontend framework:',
      choices: frameworkChoices
    }
  ]);

  return {
    platform,
    framework,
    projectName: frontendProjectDirName(projectName, platform),
    packageManager
  } as FrontendConfig;
}

async function askBackendConfig(
  projectName: string,
  packageManager: BackendConfig['packageManager']
): Promise<BackendConfig> {
  const baseAnswers = await inquirer.prompt([
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
  ]);

  let backendAnswers = {};

  if (baseAnswers.backendType === 'express') {
    backendAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'language',
        message: 'Choose backend language:',
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
    ...baseAnswers,
    ...backendAnswers,
    projectName: backendProjectDirName(projectName),
    packageManager
  } as BackendConfig;
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
    : platform === 'native'
      ? `${projectName}-mobile`
      : `${projectName}-frontend`;
}

function backendProjectDirName(projectName: string): string {
  return projectName === '__monorepo__' ? 'api' : `${projectName}-backend`;
}

function validateMonorepoSelection(
  useMonorepo: boolean,
  backendConfig: BackendConfig | null
) {
  if (!useMonorepo || !backendConfig) {
    return;
  }

  if (
    backendConfig.backendType !== 'express' &&
    backendConfig.backendType !== 'nestjs'
  ) {
    throw new Error(
      'Turborepo monorepo setup currently supports JavaScript/TypeScript backends like Express or NestJS for apps/api'
    );
  }
}

function bootstrapWorkspace(
  rootDir: string,
  packageManager: FrontendConfig['packageManager']
) {
  const command = installCommand(packageManager ?? 'npm');

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
