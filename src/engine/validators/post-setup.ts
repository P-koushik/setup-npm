import fs from 'fs-extra';
import path from 'path';
import { AddConfig } from '../../types/add-config.js';
import { AppConfig } from '../../types/app-config.js';
import { BackendConfig } from '../../types/backend-config.js';
import { FrontendConfig } from '../../types/frontend-config.js';

export async function validateFrontendOutput(
  config: FrontendConfig,
  projectPath: string
) {
  const requiredFiles = ['package.json'];

  await validateOutput(
    projectPath,
    requiredFiles,
    `${config.framework} frontend`
  );
}

export async function validateBackendOutput(
  config: BackendConfig,
  projectPath: string
) {
  const requiredFiles: Record<BackendConfig['backendType'], string[]> = {
    express: ['package.json'],
    nestjs: ['package.json'],
    fastapi: ['requirements.txt'],
    django: ['manage.py', 'requirements.txt'],
    springboot: ['pom.xml']
  };

  await validateOutput(
    projectPath,
    requiredFiles[config.backendType],
    `${config.backendType} backend`
  );
}

export async function validateAppIntegrationOutput(
  config: AppConfig,
  destinationDir: string
) {
  const requiredFiles =
    config.provider === 'firebase-auth'
      ? config.target === 'backend'
        ? ['README.md', 'firebaseAdmin.ts', 'authMiddleware.ts']
        : ['README.md', 'firebaseClient.ts', 'auth.ts']
      : config.target === 'backend'
        ? ['README.md', 'supabaseServer.ts', 'authService.ts']
        : ['README.md', 'supabaseClient.ts', 'auth.ts'];

  await validateOutput(
    destinationDir,
    requiredFiles,
    `${config.provider} ${config.target} integration`
  );
}

export async function validateAddFeatureOutput(
  features: AddConfig['features']
) {
  const requiredFiles: string[] = [];

  if (
    features.includes('cicd') ||
    features.includes('slack') ||
    features.includes('discord')
  ) {
    requiredFiles.push('.github/workflows/ci.yml');
  }

  if (features.includes('slack')) {
    requiredFiles.push('.github/workflows/slack-notification.yml');
  }

  if (features.includes('discord')) {
    requiredFiles.push('.github/workflows/discord-notification.yml');
  }

  if (features.includes('linting')) {
    requiredFiles.push('eslint.config.mjs');
  }

  if (features.includes('formatting')) {
    requiredFiles.push('.prettierrc');
  }

  if (features.includes('git-hooks')) {
    requiredFiles.push('.husky/pre-commit');
  }

  if (requiredFiles.length === 0) {
    return;
  }

  await validateOutput(process.cwd(), requiredFiles, 'added feature set');
}

async function validateOutput(
  rootPath: string,
  requiredFiles: string[],
  label: string
) {
  for (const requiredFile of requiredFiles) {
    const absolutePath = path.join(rootPath, requiredFile);

    if (!(await fs.pathExists(absolutePath))) {
      throw new Error(
        `Post-setup validation failed for ${label}. Missing: ${requiredFile}`
      );
    }
  }
}
