import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import ora from 'ora';
import { BackendConfig } from '../types/backend-config.js';

export async function buildBackend(config: BackendConfig) {
  const spinner = ora('Setting up backend...').start();

  const projectPath = path.join(process.cwd(), config.projectName);

  // ❌ check if exists
  if (await fs.pathExists(projectPath)) {
    spinner.fail('Folder already exists');
    process.exit(1);
  }

  // 1. create folder
  await fs.mkdir(projectPath);

  // 2. pick template
  const templatePath =
    config.language === 'TypeScript'
      ? path.join(process.cwd(), 'templates/backend/ts')
      : path.join(process.cwd(), 'templates/backend/js');

  // 3. copy template
  await fs.copy(templatePath, projectPath);

  spinner.text = 'Installing dependencies...';

  // 4. install deps
  process.chdir(projectPath);
  execSync('npm install', { stdio: 'inherit' });

  spinner.succeed('Backend setup complete 🚀');
}
