import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import { fileURLToPath } from 'url';
import { AddConfig } from '../types/add-config.js';
import {
  resolveTemplateRoot,
  validateTemplateDirectory
} from './validators/template.js';
import { validateAddFeatureOutput } from './validators/post-setup.js';

const templatesRoot = resolveTemplateRoot(
  [
    fileURLToPath(new URL('../templates', import.meta.url)),
    fileURLToPath(new URL('../../templates', import.meta.url))
  ],
  'Templates directory'
);

export async function addFeature(config: AddConfig) {
  const spinner = ora('Adding project scaffolding...').start();

  try {
    spinner.stop();
    const projectInfo = await detectProjectInfo();

    if (needsCicd(config.features)) {
      await addCicd(config, projectInfo);
    }

    if (needsTooling(config.features)) {
      await addTooling(config, projectInfo);
    }

    await validateAddFeatureOutput(config.features);

    spinner.succeed('Feature added successfully 🚀');
  } catch (error: unknown) {
    spinner.fail('Failed to add feature');

    if (error instanceof Error) {
      console.error(error.message);
    }

    process.exit(1);
  }
}

async function addCicd(config: AddConfig, projectInfo: ProjectInfo) {
  const workflowDir = path.join(process.cwd(), '.github', 'workflows');
  await fs.ensureDir(workflowDir);
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
    await validateCicdTemplate('slack-notification.yml');
    await copyIfMissing(
      path.join(templatesRoot, 'cicd', 'slack-notification.yml'),
      path.join(workflowDir, 'slack-notification.yml'),
      generatedFiles,
      skippedFiles
    );
  }

  if (notifications.includes('discord')) {
    await validateCicdTemplate('discord-notification.yml');
    await copyIfMissing(
      path.join(templatesRoot, 'cicd', 'discord-notification.yml'),
      path.join(workflowDir, 'discord-notification.yml'),
      generatedFiles,
      skippedFiles
    );
  }

  printSummary(generatedFiles, skippedFiles, notifications, projectInfo);
}

async function addTooling(config: AddConfig, projectInfo: ProjectInfo) {
  const packageJsonPath = path.join(process.cwd(), 'package.json');

  if (!(await fs.pathExists(packageJsonPath))) {
    throw new Error(
      'Linting, formatting, and git hooks currently require a package.json project'
    );
  }

  const generatedFiles: string[] = [];
  const skippedFiles: string[] = [];
  const packageJson = (await fs.readJson(
    packageJsonPath
  )) as MutablePackageJson;
  const isTypeScriptProject = await detectTypeScriptProject(packageJson);
  const needsFormattingBase =
    config.features.includes('formatting') ||
    config.features.includes('git-hooks');

  if (config.features.includes('linting')) {
    await writeIfMissing(
      path.join(process.cwd(), 'eslint.config.mjs'),
      generateEslintConfig(isTypeScriptProject),
      generatedFiles,
      skippedFiles
    );

    ensureDevDependencies(
      packageJson,
      getLintingDependencies(isTypeScriptProject)
    );
    ensureScript(
      packageJson,
      'lint',
      isTypeScriptProject
        ? 'eslint . --ext .js,.mjs,.cjs,.ts,.mts,.cts'
        : 'eslint . --ext .js,.mjs,.cjs'
    );
  }

  if (needsFormattingBase) {
    await writeIfMissing(
      path.join(process.cwd(), '.prettierrc'),
      generatePrettierConfig(),
      generatedFiles,
      skippedFiles
    );

    ensureDevDependencies(packageJson, { prettier: '^3.8.2' });
    ensureScript(packageJson, 'format', 'prettier --write .');
  }

  if (config.features.includes('git-hooks')) {
    const preCommitPath = path.join(process.cwd(), '.husky', 'pre-commit');

    await writeIfMissing(
      preCommitPath,
      generatePreCommitHook(),
      generatedFiles,
      skippedFiles
    );

    if (await fs.pathExists(preCommitPath)) {
      await fs.chmod(preCommitPath, 0o755);
    }

    ensureDevDependencies(packageJson, {
      husky: '^9.1.7',
      'lint-staged': '^16.4.0'
    });
    ensureScript(packageJson, 'prepare', 'husky');
    ensureLintStaged(
      packageJson,
      config.features.includes('linting'),
      needsFormattingBase,
      isTypeScriptProject
    );
  }

  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  printToolingSummary(
    generatedFiles,
    skippedFiles,
    config.features,
    projectInfo
  );
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

function printToolingSummary(
  generatedFiles: string[],
  skippedFiles: string[],
  features: AddConfig['features'],
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

  if (features.includes('linting')) {
    console.log('Added package.json support for linting.');
  }

  if (features.includes('formatting')) {
    console.log('Added package.json support for formatting.');
  }

  if (features.includes('git-hooks')) {
    console.log('Added Husky + lint-staged Git hooks configuration.');
  }

  console.log('');
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

async function validateCicdTemplate(
  templateFile: 'slack-notification.yml' | 'discord-notification.yml'
) {
  await validateTemplateDirectory(
    path.join(templatesRoot, 'cicd'),
    [templateFile],
    'CI/CD notification templates'
  );
}

async function detectTypeScriptProject(
  packageJson: MutablePackageJson
): Promise<boolean> {
  if (
    (await fs.pathExists(path.join(process.cwd(), 'tsconfig.json'))) ||
    packageJson.devDependencies?.typescript ||
    packageJson.dependencies?.typescript
  ) {
    return true;
  }

  return false;
}

function generateEslintConfig(isTypeScriptProject: boolean): string {
  if (!isTypeScriptProject) {
    return `import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist', 'build', 'coverage', 'node_modules']
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node
    }
  },
  prettier
];
`;
  }

  return `import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist', 'build', 'coverage', 'node_modules']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      globals: globals.node
    }
  },
  prettier
];
`;
}

function generatePrettierConfig(): string {
  return `{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "none"
}
`;
}

function generatePreCommitHook(): string {
  return `#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
`;
}

function getLintingDependencies(
  isTypeScriptProject: boolean
): Record<string, string> {
  if (!isTypeScriptProject) {
    return {
      eslint: '^10.2.0',
      '@eslint/js': '^10.0.1',
      globals: '^17.4.0',
      'eslint-config-prettier': '^10.1.8'
    };
  }

  return {
    eslint: '^10.2.0',
    '@eslint/js': '^10.0.1',
    globals: '^17.4.0',
    'eslint-config-prettier': '^10.1.8',
    typescript: '^6.0.2',
    'typescript-eslint': '^8.58.1'
  };
}

function ensureDevDependencies(
  packageJson: MutablePackageJson,
  dependencies: Record<string, string>
) {
  packageJson.devDependencies ||= {};

  for (const [name, version] of Object.entries(dependencies)) {
    if (
      !packageJson.devDependencies[name] &&
      !packageJson.dependencies?.[name]
    ) {
      packageJson.devDependencies[name] = version;
    }
  }
}

function ensureScript(
  packageJson: MutablePackageJson,
  name: string,
  command: string
) {
  packageJson.scripts ||= {};

  if (!packageJson.scripts[name]) {
    packageJson.scripts[name] = command;
  }
}

function ensureLintStaged(
  packageJson: MutablePackageJson,
  useLinting: boolean,
  useFormatting: boolean,
  isTypeScriptProject: boolean
) {
  packageJson['lint-staged'] ||= {};

  const lintPattern = isTypeScriptProject
    ? '*.{js,mjs,cjs,ts,mts,cts}'
    : '*.{js,mjs,cjs}';
  const formatPattern = useLinting
    ? '*.{json,md,css,scss,yml,yaml}'
    : '*.{js,mjs,cjs,ts,mts,cts,json,md,css,scss,yml,yaml}';

  if (useLinting && !packageJson['lint-staged'][lintPattern]) {
    packageJson['lint-staged'][lintPattern] = useFormatting
      ? ['eslint --fix', 'prettier --write']
      : ['eslint --fix'];
  }

  if (useFormatting && !packageJson['lint-staged'][formatPattern]) {
    packageJson['lint-staged'][formatPattern] = ['prettier --write'];
  }
}

function needsCicd(features: AddConfig['features']): boolean {
  return features.some(
    (feature) =>
      feature === 'cicd' || feature === 'slack' || feature === 'discord'
  );
}

function needsTooling(features: AddConfig['features']): boolean {
  return features.some(
    (feature) =>
      feature === 'linting' ||
      feature === 'formatting' ||
      feature === 'git-hooks'
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

type MutablePackageJson = PackageJson & {
  'lint-staged'?: Record<string, string[]>;
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
