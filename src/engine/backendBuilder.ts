import { execSync } from 'child_process';
import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import { fileURLToPath } from 'url';
import { BackendConfig } from '../types/backend-config.js';
import {
  resolveTemplateRoot,
  validateTemplateDirectory
} from './validators/template.js';

const templatesRoot = resolveTemplateRoot(
  [
    fileURLToPath(new URL('../templates/backend', import.meta.url)),
    fileURLToPath(new URL('../../templates/backend', import.meta.url))
  ],
  'Backend templates directory'
);

export async function buildBackend(config: BackendConfig) {
  const spinner = ora('Setting up backend...').start();
  const baseDir = config.destinationDir ?? process.cwd();
  const projectPath = path.join(baseDir, config.projectName);

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
        scaffoldNest(
          config.projectName,
          config.packageManager,
          config.destinationDir ?? process.cwd()
        );
        break;

      case 'fastapi':
        await scaffoldFastApi(config.projectName, projectPath);
        break;

      case 'django':
        await scaffoldDjango(config.projectName, projectPath);
        break;

      case 'springboot':
        await scaffoldSpringBoot(config.projectName, projectPath);
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
  await validateBackendTemplate(templateName, templatePath);

  runStep(`Copying ${config.language} Express template files`);
  await fs.copy(templatePath, projectPath);
  runCommand(
    'Installing dependencies',
    installCommand(config.packageManager ?? 'npm'),
    projectPath
  );
}

function scaffoldNest(
  projectName: string,
  packageManager: BackendConfig['packageManager'],
  cwd: string
) {
  runCommand(
    'Scaffolding NestJS project',
    `${packageManager === 'bun' ? 'bunx' : 'npx'} @nestjs/cli@latest new ${quote(
      projectName
    )} --package-manager ${packageManager ?? 'npm'} --skip-git`,
    cwd
  );
}

async function scaffoldFastApi(projectName: string, projectPath: string) {
  const templatePath = path.join(templatesRoot, 'fastapi');
  await validateBackendTemplate('fastapi', templatePath);

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

async function scaffoldDjango(projectName: string, projectPath: string) {
  const templatePath = path.join(templatesRoot, 'django');
  await validateBackendTemplate('django', templatePath);

  runStep('Copying Django production template files');
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

async function scaffoldSpringBoot(projectName: string, projectPath: string) {
  const templatePath = path.join(templatesRoot, 'springboot');
  await validateBackendTemplate('springboot', templatePath);

  runStep('Copying Spring Boot template files');
  await fs.copy(templatePath, projectPath);

  const mavenCommand = getMavenCommand();

  if (!mavenCommand) {
    console.log('\n▶ Maven dependency setup skipped');
    console.log('Maven was not found in PATH.');
    console.log(`Next step: cd ${projectName} && mvn dependency:resolve\n`);
    return;
  }

  runCommand(
    'Resolving Maven dependencies',
    `${mavenCommand} dependency:resolve`,
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

function getMavenCommand(): string | null {
  const candidates =
    process.platform === 'win32' ? ['mvn.cmd', 'mvn'] : ['mvn'];

  for (const candidate of candidates) {
    try {
      execSync(`${candidate} -v`, { stdio: 'ignore' });
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

function runCommand(step: string, command: string, cwd?: string) {
  runStep(step, `${cwd ? `cd ${quote(cwd)} && ` : ''}${command}`);

  execSync(command, {
    cwd,
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

async function validateBackendTemplate(
  templateName: 'ts' | 'js' | 'fastapi' | 'django' | 'springboot',
  templatePath: string
) {
  const requiredFiles: Record<typeof templateName, string[]> = {
    ts: ['package.json', 'src/server.ts', 'src/app.ts', 'README.md'],
    js: ['package.json', 'src/server.js', 'src/app.js', 'README.md'],
    fastapi: ['requirements.txt', 'app/main.py', 'README.md'],
    django: [
      'manage.py',
      'requirements.txt',
      'config/settings.py',
      'README.md'
    ],
    springboot: ['pom.xml', 'README.md']
  };

  await validateTemplateDirectory(
    templatePath,
    requiredFiles[templateName],
    `${templateName} backend template`
  );
}
