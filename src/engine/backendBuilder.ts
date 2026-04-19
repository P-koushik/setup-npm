import { execSync } from 'child_process';
import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import { fileURLToPath } from 'url';
import { BackendConfig } from '../types/backend-config.js';

const templatesRoot = resolveTemplatesRoot();

export async function buildBackend(config: BackendConfig) {
  const spinner = ora('Setting up backend...').start();
  const projectPath = path.join(process.cwd(), config.projectName);

  if (await fs.pathExists(projectPath)) {
    spinner.fail('Folder already exists');
    process.exit(1);
  }

  try {
    spinner.stop();

    switch (config.backendType) {
      case 'express':
        await scaffoldExpress(config, projectPath);
        break;

      case 'nestjs':
        scaffoldNest(config.projectName);
        break;

      case 'fastapi':
        await scaffoldFastApi(config.projectName, projectPath);
        break;

      default:
        throw new Error('Unsupported backend type');
    }

    spinner.succeed('Backend setup complete 🚀');
  } catch (error: unknown) {
    spinner.fail('Failed to create backend');

    if (error instanceof Error) {
      console.error(error.message);
    }

    process.exit(1);
  }
}

async function scaffoldExpress(config: BackendConfig, projectPath: string) {
  if (!config.language) {
    throw new Error('Express setup requires a language selection');
  }

  const templateName = config.language === 'TypeScript' ? 'ts' : 'js';
  const templatePath = path.join(templatesRoot, templateName);

  runStep(`Copying ${config.language} Express template files`);
  await fs.copy(templatePath, projectPath);
  runCommand('Installing dependencies', 'npm install', projectPath);
}

function scaffoldNest(projectName: string) {
  runCommand(
    'Scaffolding NestJS project',
    `npx @nestjs/cli@latest new ${quote(projectName)} --package-manager npm --skip-git`
  );
}

async function scaffoldFastApi(projectName: string, projectPath: string) {
  const templatePath = path.join(templatesRoot, 'fastapi');

  runStep('Copying FastAPI production template files');
  await fs.copy(templatePath, projectPath);

  const pythonCommand = getPythonCommand();

  if (!pythonCommand) {
    console.log('\n▶ Python environment setup skipped');
    console.log('Python was not found in PATH.');
    console.log(`Next step: cd ${projectName} && python3 -m venv .venv\n`);
    return;
  }

  runCommand(
    'Creating virtual environment',
    `${pythonCommand} -m venv .venv`,
    projectPath
  );
  runCommand(
    'Installing Python dependencies',
    `${quote(getVenvPython(projectPath))} -m pip install -r requirements.txt`,
    projectPath
  );
}

function getPythonCommand(): string | null {
  const candidates =
    process.platform === 'win32'
      ? ['py', 'python', 'python3']
      : ['python3', 'python'];

  for (const candidate of candidates) {
    try {
      execSync(`${candidate} --version`, { stdio: 'ignore' });
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

function getVenvPython(projectPath: string): string {
  return process.platform === 'win32'
    ? path.join(projectPath, '.venv', 'Scripts', 'python.exe')
    : path.join(projectPath, '.venv', 'bin', 'python');
}

function runCommand(step: string, command: string, cwd?: string) {
  runStep(step, `${cwd ? `cd ${quote(cwd)} && ` : ''}${command}`);

  execSync(command, {
    cwd,
    stdio: 'inherit'
  });
}

function runStep(step: string, command?: string) {
  console.log(`\n▶ ${step}`);

  if (command) {
    console.log(`$ ${command}`);
  }

  console.log('');
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function resolveTemplatesRoot(): string {
  const candidates = [
    fileURLToPath(new URL('../templates/backend', import.meta.url)),
    fileURLToPath(new URL('../../templates/backend', import.meta.url))
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Backend templates directory not found. Checked: ${candidates.join(', ')}`
  );
}
