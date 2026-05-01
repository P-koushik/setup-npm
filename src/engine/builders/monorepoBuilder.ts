import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { FrontendConfig } from '../../types/frontend-config.js';

type PackageManager = NonNullable<FrontendConfig['packageManager']>;

export async function createWorkspaceRoot(
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

  await createWorkspaceConfigPackages(rootDir);
  await createSharedTypesPackage(rootDir, scope);
  await createSharedModelsPackage(rootDir, scope);
}

export async function wireWorkspaceApps(
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

export async function wireMonorepoFrontend(
  rootDir: string,
  frontendConfig: FrontendConfig,
  scope: string
) {
  const webDirName = frontendConfig.projectName;
  const webDir = path.join(rootDir, 'apps', webDirName);

  await addWorkspaceDependencies(path.join(webDir, 'package.json'), {
    name: frontendConfig.platform === 'native' ? 'mobile' : 'web',
    dependencies: {
      [`@${scope}/types`]: '*',
      [`@${scope}/models`]: '*'
    }
  });
  await ensureWorkspaceDevScript(path.join(webDir, 'package.json'));

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

export async function bootstrapWorkspace(
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

export function workspaceScope(projectName: string): string {
  const normalized = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'repo';
}

async function createWorkspaceConfigPackages(rootDir: string) {
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
}

async function createSharedTypesPackage(rootDir: string, scope: string) {
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
      dependencies: {
        mongoose: '^8.19.2'
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
    `import type { Document } from 'mongoose';

export enum UserRole {
  Admin = 'admin',
  User = 'user'
}

export type TUser = Document & {
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};
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
}

async function createSharedModelsPackage(rootDir: string, scope: string) {
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
        [`@${scope}/types`]: '*',
        mongoose: '^8.19.2'
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
    `import { Schema, model, models } from 'mongoose';
import { TUser, UserRole } from '@${scope}/types/user';

const user_schema = new Schema<TUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.User
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

export const User = models.User || model<TUser>('User', user_schema);
`
  );

  await fs.writeFile(
    path.join(rootDir, 'packages', 'models', 'src', 'index.ts'),
    `export * from './user-model.js';
`
  );
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

async function ensureWorkspaceDevScript(packageJsonPath: string) {
  if (!(await fs.pathExists(packageJsonPath))) {
    return;
  }

  const packageJson = (await fs.readJson(packageJsonPath)) as {
    scripts?: Record<string, string>;
  };

  if (!packageJson.scripts?.start || packageJson.scripts.dev) {
    return;
  }

  packageJson.scripts.dev = packageJson.scripts.start;
  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
}

function installCommand(packageManager: PackageManager): string {
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

function workspacePackageManagerSpec(packageManager: PackageManager): string {
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
