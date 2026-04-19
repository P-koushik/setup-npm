import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import { fileURLToPath } from 'url';
import { AddConfig } from '../types/add-config.js';

const templatesRoot = resolveTemplatesRoot();

export async function addFeature(config: AddConfig) {
  const spinner = ora('Adding project scaffolding...').start();

  try {
    spinner.stop();
    await addCicd(config);

    spinner.succeed('Feature added successfully 🚀');
  } catch (error: unknown) {
    spinner.fail('Failed to add feature');

    if (error instanceof Error) {
      console.error(error.message);
    }

    process.exit(1);
  }
}

async function addCicd(config: AddConfig) {
  const workflowDir = path.join(process.cwd(), '.github', 'workflows');
  await fs.ensureDir(workflowDir);

  const projectInfo = await detectProjectInfo();
  const generatedFiles: string[] = [];
  const skippedFiles: string[] = [];
  const notifications = config.features.filter(
    (feature): feature is 'slack' | 'discord' =>
      feature === 'slack' || feature === 'discord'
  );

  await writeIfMissing(
    path.join(workflowDir, 'ci.yml'),
    generateCiWorkflow(projectInfo),
    generatedFiles,
    skippedFiles
  );

  if (notifications.includes('slack')) {
    await copyIfMissing(
      path.join(templatesRoot, 'cicd', 'slack-notification.yml'),
      path.join(workflowDir, 'slack-notification.yml'),
      generatedFiles,
      skippedFiles
    );
  }

  if (notifications.includes('discord')) {
    await copyIfMissing(
      path.join(templatesRoot, 'cicd', 'discord-notification.yml'),
      path.join(workflowDir, 'discord-notification.yml'),
      generatedFiles,
      skippedFiles
    );
  }

  printSummary(generatedFiles, skippedFiles, notifications, projectInfo);
}

async function copyIfMissing(
  source: string,
  destination: string,
  generatedFiles: string[],
  skippedFiles: string[]
) {
  if (await fs.pathExists(destination)) {
    skippedFiles.push(path.relative(process.cwd(), destination));
    return;
  }

  console.log(`\n▶ Creating ${path.relative(process.cwd(), destination)}`);
  console.log(`$ copy template from ${source}\n`);

  await fs.copy(source, destination);
  generatedFiles.push(path.relative(process.cwd(), destination));
}

async function writeIfMissing(
  destination: string,
  content: string,
  generatedFiles: string[],
  skippedFiles: string[]
) {
  if (await fs.pathExists(destination)) {
    skippedFiles.push(path.relative(process.cwd(), destination));
    return;
  }

  console.log(`\n▶ Creating ${path.relative(process.cwd(), destination)}`);
  console.log('$ generate project-aware workflow\n');

  await fs.outputFile(destination, content);
  generatedFiles.push(path.relative(process.cwd(), destination));
}

function printSummary(
  generatedFiles: string[],
  skippedFiles: string[],
  notifications: Array<'slack' | 'discord'>,
  projectInfo: ProjectInfo
) {
  if (generatedFiles.length > 0) {
    console.log('Created files:');
    for (const file of generatedFiles) {
      console.log(`- ${file}`);
    }
    console.log('');
  }

  console.log(`Detected environment: ${projectInfo.summary}\n`);

  if (skippedFiles.length > 0) {
    console.log('Skipped existing files:');
    for (const file of skippedFiles) {
      console.log(`- ${file}`);
    }
    console.log('');
  }

  if (notifications.includes('slack')) {
    console.log('Required GitHub secret: `SLACK_WEBHOOK_URL`');
  }

  if (notifications.includes('discord')) {
    console.log('Required GitHub secret: `DISCORD_WEBHOOK_URL`');
  }

  if (notifications.length > 0) {
    console.log(
      'Notification workflows trigger when the `CI` workflow completes.\n'
    );
  }
}

function generateCiWorkflow(projectInfo: ProjectInfo): string {
  switch (projectInfo.kind) {
    case 'node':
      return generateNodeWorkflow(projectInfo);
    case 'python':
      return generatePythonWorkflow(projectInfo);
    case 'java':
      return generateJavaWorkflow(projectInfo);
  }
}

function generateNodeWorkflow(projectInfo: NodeProjectInfo): string {
  const steps = [
    indent('- name: Checkout code', 6),
    indent('uses: actions/checkout@v4', 8),
    '',
    indent('- name: Setup Node.js', 6),
    indent('uses: actions/setup-node@v4', 8),
    indent('with:', 8),
    indent(`node-version: '${projectInfo.nodeVersion}'`, 10),
    ...nodeCacheLines(projectInfo.packageManager),
    '',
    indent('- name: Install dependencies', 6),
    indent(`run: ${projectInfo.installCommand}`, 8)
  ];

  for (const step of projectInfo.scriptSteps) {
    steps.push('');
    steps.push(indent(`- name: ${step.name}`, 6));
    steps.push(indent(`run: ${step.command}`, 8));
  }

  return `${workflowHeader()}
jobs:
  ci:
    name: ${yamlQuote(projectInfo.jobName)}
    runs-on: ubuntu-latest

    steps:
${steps.join('\n')}
`;
}

function generatePythonWorkflow(projectInfo: PythonProjectInfo): string {
  const steps = [
    indent('- name: Checkout code', 6),
    indent('uses: actions/checkout@v4', 8),
    '',
    indent('- name: Setup Python', 6),
    indent('uses: actions/setup-python@v5', 8),
    indent('with:', 8),
    indent(`python-version: '${projectInfo.pythonVersion}'`, 10),
    '',
    indent('- name: Upgrade pip', 6),
    indent('run: python -m pip install --upgrade pip', 8),
    '',
    indent('- name: Install dependencies', 6),
    indent('run: |', 8),
    ...projectInfo.installCommands.map((command) => indent(command, 10))
  ];

  for (const step of projectInfo.steps) {
    steps.push('');
    steps.push(indent(`- name: ${step.name}`, 6));
    if (step.multiline) {
      steps.push(indent('run: |', 8));
      for (const line of step.command.split('\n')) {
        steps.push(indent(line, 10));
      }
    } else {
      steps.push(indent(`run: ${step.command}`, 8));
    }
  }

  return `${workflowHeader()}
jobs:
  ci:
    name: ${yamlQuote(projectInfo.jobName)}
    runs-on: ubuntu-latest

    steps:
${steps.join('\n')}
`;
}

function generateJavaWorkflow(projectInfo: JavaProjectInfo): string {
  const steps = [
    indent('- name: Checkout code', 6),
    indent('uses: actions/checkout@v4', 8),
    '',
    indent('- name: Setup Java', 6),
    indent('uses: actions/setup-java@v4', 8),
    indent('with:', 8),
    indent('distribution: temurin', 10),
    indent(`java-version: '${projectInfo.javaVersion}'`, 10),
    indent(`cache: ${projectInfo.buildTool}`, 10),
    '',
    indent(`- name: ${projectInfo.stepName}`, 6),
    indent(`run: ${projectInfo.command}`, 8)
  ];

  return `${workflowHeader()}
jobs:
  ci:
    name: ${yamlQuote(projectInfo.jobName)}
    runs-on: ubuntu-latest

    steps:
${steps.join('\n')}
`;
}

function workflowHeader(): string {
  return `name: CI

on:
  push:
    branches:
      - main
      - develop
  pull_request:
    branches:
      - main
      - develop
`;
}

async function detectProjectInfo(): Promise<ProjectInfo> {
  const cwd = process.cwd();

  if (await fs.pathExists(path.join(cwd, 'package.json'))) {
    return detectNodeProject(cwd);
  }

  if (
    (await fs.pathExists(path.join(cwd, 'pyproject.toml'))) ||
    (await fs.pathExists(path.join(cwd, 'requirements.txt'))) ||
    (await fs.pathExists(path.join(cwd, 'manage.py')))
  ) {
    return detectPythonProject(cwd);
  }

  if (
    (await fs.pathExists(path.join(cwd, 'pom.xml'))) ||
    (await fs.pathExists(path.join(cwd, 'build.gradle'))) ||
    (await fs.pathExists(path.join(cwd, 'build.gradle.kts')))
  ) {
    return detectJavaProject(cwd);
  }

  return {
    kind: 'node',
    summary: 'Node.js project (default fallback)',
    jobName: 'Node.js Checks',
    packageManager: 'npm',
    installCommand: 'npm ci',
    nodeVersion: '20',
    scriptSteps: []
  };
}

async function detectNodeProject(cwd: string): Promise<NodeProjectInfo> {
  const packageJsonPath = path.join(cwd, 'package.json');
  const packageJson = JSON.parse(
    await fs.readFile(packageJsonPath, 'utf8')
  ) as PackageJson;
  const packageManager = await detectNodePackageManager(
    cwd,
    packageJson.packageManager
  );
  const scriptSteps: WorkflowStep[] = [];
  const scripts = packageJson.scripts || {};
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  for (const scriptName of ['lint', 'test', 'typecheck', 'build']) {
    if (typeof scripts[scriptName] === 'string') {
      scriptSteps.push({
        name: stepLabel(scriptName),
        command: `${packageManager} run ${scriptName}`
      });
    }
  }

  let summary = `${labelForPackageManager(packageManager)} project`;

  if (typeof deps.next === 'string') {
    summary = `Next.js project using ${labelForPackageManager(packageManager)}`;
  } else if (typeof deps.nuxt === 'string') {
    summary = `Nuxt project using ${labelForPackageManager(packageManager)}`;
  } else if (typeof deps.react === 'string' && typeof deps.vite === 'string') {
    summary = `React + Vite project using ${labelForPackageManager(packageManager)}`;
  } else if (typeof deps.vue === 'string' && typeof deps.vite === 'string') {
    summary = `Vue + Vite project using ${labelForPackageManager(packageManager)}`;
  } else if (typeof deps['@nestjs/core'] === 'string') {
    summary = `NestJS project using ${labelForPackageManager(packageManager)}`;
  }

  return {
    kind: 'node',
    summary,
    jobName: 'Node.js Checks',
    packageManager,
    installCommand: installCommandForPackageManager(packageManager),
    nodeVersion: parseNodeVersion(packageJson.engines?.node),
    scriptSteps
  };
}

async function detectPythonProject(cwd: string): Promise<PythonProjectInfo> {
  const hasPyproject = await fs.pathExists(path.join(cwd, 'pyproject.toml'));
  const hasRequirements = await fs.pathExists(
    path.join(cwd, 'requirements.txt')
  );
  const hasManagePy = await fs.pathExists(path.join(cwd, 'manage.py'));
  const hasPytestConfig =
    (await fs.pathExists(path.join(cwd, 'pytest.ini'))) ||
    (await fs.pathExists(path.join(cwd, 'tests'))) ||
    (hasPyproject &&
      (await fs.readFile(path.join(cwd, 'pyproject.toml'), 'utf8')).includes(
        'pytest'
      ));

  const installCommands: string[] = [];

  if (hasRequirements) {
    installCommands.push('pip install -r requirements.txt');
  } else if (hasPyproject) {
    installCommands.push('pip install .');
  } else {
    installCommands.push(
      'echo "No dependency manifest found, skipping install"'
    );
  }

  if (await fs.pathExists(path.join(cwd, 'requirements-dev.txt'))) {
    installCommands.push('pip install -r requirements-dev.txt');
  }

  const steps: PythonWorkflowStep[] = [];

  if (hasManagePy) {
    steps.push({
      name: 'Run Django checks',
      command: 'python manage.py check'
    });
    if (hasPytestConfig) {
      steps.push({ name: 'Run tests', command: 'python -m pytest' });
    }

    return {
      kind: 'python',
      summary: 'Django project',
      jobName: 'Python Checks',
      pythonVersion: '3.12',
      installCommands,
      steps
    };
  }

  if (hasPytestConfig) {
    steps.push({ name: 'Run tests', command: 'python -m pytest' });
  }

  if (hasPyproject) {
    const pyproject = await fs.readFile(
      path.join(cwd, 'pyproject.toml'),
      'utf8'
    );

    if (pyproject.includes('ruff')) {
      steps.unshift({ name: 'Run Ruff', command: 'python -m ruff check .' });
    }

    if (pyproject.includes('fastapi')) {
      return {
        kind: 'python',
        summary: 'FastAPI-style Python project',
        jobName: 'Python Checks',
        pythonVersion: '3.12',
        installCommands,
        steps
      };
    }
  }

  return {
    kind: 'python',
    summary: 'Python project',
    jobName: 'Python Checks',
    pythonVersion: '3.12',
    installCommands,
    steps
  };
}

async function detectJavaProject(cwd: string): Promise<JavaProjectInfo> {
  if (await fs.pathExists(path.join(cwd, 'pom.xml'))) {
    return {
      kind: 'java',
      summary: 'Java project with Maven',
      jobName: 'Java Checks',
      javaVersion: '21',
      buildTool: 'maven',
      stepName: 'Verify with Maven',
      command: 'mvn -B verify'
    };
  }

  return {
    kind: 'java',
    summary: 'Java project with Gradle',
    jobName: 'Java Checks',
    javaVersion: '21',
    buildTool: 'gradle',
    stepName: 'Verify with Gradle',
    command: './gradlew build'
  };
}

async function detectNodePackageManager(
  cwd: string,
  packageManagerField?: string
): Promise<'npm' | 'pnpm' | 'yarn' | 'bun'> {
  const normalizedField = packageManagerField?.split('@')[0];

  if (
    normalizedField === 'pnpm' ||
    normalizedField === 'yarn' ||
    normalizedField === 'bun'
  ) {
    return normalizedField;
  }

  if (await fs.pathExists(path.join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }

  if (await fs.pathExists(path.join(cwd, 'yarn.lock'))) {
    return 'yarn';
  }

  if (
    (await fs.pathExists(path.join(cwd, 'bun.lockb'))) ||
    (await fs.pathExists(path.join(cwd, 'bun.lock')))
  ) {
    return 'bun';
  }

  return 'npm';
}

function installCommandForPackageManager(
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
): string {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm install --frozen-lockfile';
    case 'yarn':
      return 'yarn install --frozen-lockfile';
    case 'bun':
      return 'bun install --frozen-lockfile';
    case 'npm':
      return 'npm ci';
  }
}

function labelForPackageManager(
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
): string {
  switch (packageManager) {
    case 'npm':
      return 'Node.js/npm';
    case 'pnpm':
      return 'Node.js/pnpm';
    case 'yarn':
      return 'Node.js/yarn';
    case 'bun':
      return 'Node.js/bun';
  }
}

function nodeCacheLines(
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
): string[] {
  if (packageManager === 'bun') {
    return [];
  }

  return [indent(`cache: ${packageManager}`, 10)];
}

function parseNodeVersion(engine?: string): string {
  if (!engine) {
    return '20';
  }

  const match = engine.match(/\d+/);
  return match ? match[0] : '20';
}

function stepLabel(scriptName: string): string {
  switch (scriptName) {
    case 'lint':
      return 'Run lint';
    case 'test':
      return 'Run tests';
    case 'typecheck':
      return 'Run typecheck';
    case 'build':
      return 'Build project';
    default:
      return `Run ${scriptName}`;
  }
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

function indent(value: string, spaces: number): string {
  return `${' '.repeat(spaces)}${value}`;
}

function yamlQuote(value: string): string {
  return `'${value.split("'").join("''")}'`;
}

type WorkflowStep = {
  name: string;
  command: string;
};

type PythonWorkflowStep = WorkflowStep & {
  multiline?: boolean;
};

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: {
    node?: string;
  };
  packageManager?: string;
};

type NodeProjectInfo = {
  kind: 'node';
  summary: string;
  jobName: string;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  installCommand: string;
  nodeVersion: string;
  scriptSteps: WorkflowStep[];
};

type PythonProjectInfo = {
  kind: 'python';
  summary: string;
  jobName: string;
  pythonVersion: string;
  installCommands: string[];
  steps: PythonWorkflowStep[];
};

type JavaProjectInfo = {
  kind: 'java';
  summary: string;
  jobName: string;
  javaVersion: string;
  buildTool: 'maven' | 'gradle';
  stepName: string;
  command: string;
};

type ProjectInfo = NodeProjectInfo | PythonProjectInfo | JavaProjectInfo;
