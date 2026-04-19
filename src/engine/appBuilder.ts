import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppConfig } from '../types/app-config.js';

const templatesRoot = resolveTemplatesRoot();

export async function buildAppIntegration(config: AppConfig) {
  const spinner = ora('Adding app integration...').start();

  try {
    spinner.stop();

    const sourceDir = path.join(
      templatesRoot,
      'app',
      config.provider,
      config.target
    );
    const destinationDir = path.join(
      process.cwd(),
      'integrations',
      config.provider,
      config.target
    );

    if (!(await fs.pathExists(sourceDir))) {
      throw new Error('Integration template not found');
    }

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
  console.log(`Target: ${config.target}\n`);
}

function resolveTemplatesRoot(): string {
  const candidates = [
    fileURLToPath(new URL('../templates', import.meta.url)),
    fileURLToPath(new URL('../../templates', import.meta.url))
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Templates directory not found. Checked: ${candidates.join(', ')}`
  );
}
