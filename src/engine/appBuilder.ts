import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppConfig } from '../types/app-config.js';
import {
  resolveTemplateRoot,
  validateTemplateDirectory
} from './validators/template.js';

const templatesRoot = resolveTemplateRoot(
  [
    fileURLToPath(new URL('../templates', import.meta.url)),
    fileURLToPath(new URL('../../templates', import.meta.url))
  ],
  'Templates directory'
);

export async function buildAppIntegration(config: AppConfig) {
  const spinner = ora('Adding app integration...').start();

  try {
    spinner.stop();

    const sourceDir = path.join(
      templatesRoot,
      'app',
      config.provider,
      config.target,
      ...(config.target === 'frontend' && config.frontendPlatform
        ? [config.frontendPlatform]
        : [])
    );
    const destinationDir = path.join(
      process.cwd(),
      'integrations',
      config.provider,
      config.target,
      ...(config.target === 'frontend' && config.frontendPlatform
        ? [config.frontendPlatform]
        : [])
    );

    await validateAppTemplate(config, sourceDir);

    await fs.ensureDir(destinationDir);

    const files = await fs.readdir(sourceDir);
    const createdFiles: string[] = [];
    const skippedFiles: string[] = [];

    for (const file of files) {
      const source = path.join(sourceDir, file);
      const destination = path.join(destinationDir, file);

      if (await fs.pathExists(destination)) {
        skippedFiles.push(path.relative(process.cwd(), destination));
        continue;
      }

      console.log(`\n▶ Creating ${path.relative(process.cwd(), destination)}`);
      console.log(`$ copy template from ${source}\n`);

      await fs.copy(source, destination);
      createdFiles.push(path.relative(process.cwd(), destination));
    }

    printSummary(config, createdFiles, skippedFiles, destinationDir);
    spinner.succeed('App integration added successfully 🚀');
  } catch (error: unknown) {
    spinner.fail('Failed to add app integration');

    if (error instanceof Error) {
      console.error(error.message);
    }

    process.exit(1);
  }
}

function printSummary(
  config: AppConfig,
  createdFiles: string[],
  skippedFiles: string[],
  destinationDir: string
) {
  if (createdFiles.length > 0) {
    console.log('Created files:');
    for (const file of createdFiles) {
      console.log(`- ${file}`);
    }
    console.log('');
  }

  if (skippedFiles.length > 0) {
    console.log('Skipped existing files:');
    for (const file of skippedFiles) {
      console.log(`- ${file}`);
    }
    console.log('');
  }

  console.log(
    `Integration location: ${path.relative(process.cwd(), destinationDir)}`
  );
  console.log(`Provider: ${config.provider}`);
  console.log(`Target: ${config.target}`);

  if (config.target === 'frontend' && config.frontendPlatform) {
    console.log(`Frontend platform: ${config.frontendPlatform}`);
  }

  console.log('');
}

async function validateAppTemplate(config: AppConfig, templatePath: string) {
  const requiredFiles =
    config.provider === 'firebase-auth'
      ? config.target === 'backend'
        ? ['README.md', 'firebaseAdmin.ts', 'authMiddleware.ts']
        : config.frontendPlatform === 'mobile'
          ? ['README.md', 'firebaseClient.ts', 'auth.ts']
          : ['README.md', 'firebaseClient.ts', 'auth.ts']
      : config.target === 'backend'
        ? ['README.md', 'supabaseServer.ts', 'authService.ts']
        : config.frontendPlatform === 'mobile'
          ? ['README.md', 'supabaseClient.ts', 'auth.ts']
          : ['README.md', 'supabaseClient.ts', 'auth.ts'];

  await validateTemplateDirectory(
    templatePath,
    requiredFiles,
    `${config.provider} ${config.target} integration template`
  );
}
