import fs from 'fs-extra';
import path from 'path';
import { plugins } from '../../plugins/registry.js';
import { PluginContext } from '../../types/plugin.js';

export async function runPlugin(
  pluginName: keyof typeof plugins,
  config: Record<string, unknown>
) {
  const plugin = plugins[pluginName];

  if (!plugin) {
    throw new Error(`Unknown plugin: ${pluginName}`);
  }

  const context = await createPluginContext(config);

  await plugin.apply(context);
}

async function createPluginContext(
  config: Record<string, unknown>
): Promise<PluginContext> {
  const projectPath = process.cwd();
  const packageManager = await detectPackageManager(projectPath);

  return {
    projectPath,
    projectType: await detectProjectType(projectPath),
    framework: await detectFramework(projectPath),
    packageManager,
    config
  };
}

async function detectProjectType(
  projectPath: string
): Promise<PluginContext['projectType']> {
  if (await fs.pathExists(path.join(projectPath, 'turbo.json'))) {
    return 'monorepo';
  }

  if (
    (await fs.pathExists(path.join(projectPath, 'manage.py'))) ||
    (await fs.pathExists(path.join(projectPath, 'pom.xml'))) ||
    (await fs.pathExists(path.join(projectPath, 'src', 'server.ts'))) ||
    (await fs.pathExists(path.join(projectPath, 'src', 'server.js')))
  ) {
    return 'backend';
  }

  return 'frontend';
}

async function detectFramework(
  projectPath: string
): Promise<string | undefined> {
  const packageJsonPath = path.join(projectPath, 'package.json');

  if (!(await fs.pathExists(packageJsonPath))) {
    if (await fs.pathExists(path.join(projectPath, 'manage.py'))) {
      return 'django';
    }

    if (await fs.pathExists(path.join(projectPath, 'pom.xml'))) {
      return 'springboot';
    }

    return undefined;
  }

  const packageJson = (await fs.readJson(packageJsonPath)) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  if (deps.next) {
    return 'next';
  }

  if (deps.vue) {
    return 'vue';
  }

  if (deps.react) {
    return 'react';
  }

  if (deps['@nestjs/core']) {
    return 'nestjs';
  }

  if (deps.express) {
    return 'express';
  }

  return undefined;
}

async function detectPackageManager(
  projectPath: string
): Promise<PluginContext['packageManager']> {
  if (await fs.pathExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }

  if (await fs.pathExists(path.join(projectPath, 'yarn.lock'))) {
    return 'yarn';
  }

  return 'npm';
}
