import { execFileSync } from 'child_process';
import { BackendConfig } from '../../types/backend-config.js';
import { FrontendConfig } from '../../types/frontend-config.js';

type PackageManager = NonNullable<FrontendConfig['packageManager']>;

export type DoctorConfig = {
  packageManager?: PackageManager;
  useMonorepo?: boolean;
  frontendConfig?: FrontendConfig | null;
  backendConfig?: BackendConfig | null;
};

type Requirement = {
  id: string;
  commands: string[];
  label: string;
  neededBy: string;
  wouldRun: string;
  fix: string;
};

type MissingRequirement = Requirement & {
  checkedCommands: string[];
};

type CheckedRequirement = Requirement & {
  foundCommand: string | null;
};

export class DoctorError extends Error {
  constructor(public readonly missing: MissingRequirement[]) {
    super(formatDoctorError(missing));
    this.name = 'DoctorError';
  }
}

export function runDoctor(config: DoctorConfig) {
  const requirements = dedupeRequirements(collectRequirements(config));
  const checkedRequirements = requirements.map((requirement) => ({
    ...requirement,
    foundCommand: findAvailableCommand(requirement.commands)
  }));
  const missing = checkedRequirements
    .filter((requirement) => !requirement.foundCommand)
    .map((requirement) => ({
      ...requirement,
      checkedCommands: requirement.commands
    }));

  if (missing.length > 0) {
    throw new DoctorError(missing);
  }

  console.log(formatDoctorSuccess(checkedRequirements));
}

function collectRequirements(config: DoctorConfig): Requirement[] {
  const packageManager = config.packageManager ?? 'npm';
  const requirements = config.packageManager
    ? [packageManagerRequirement(packageManager)]
    : [];

  if (config.frontendConfig) {
    requirements.push(
      ...frontendRequirements(config.frontendConfig, packageManager)
    );
  }

  if (config.backendConfig) {
    requirements.push(...backendRequirements(config.backendConfig));
  }

  if (config.useMonorepo) {
    requirements.push({
      ...packageManagerRequirement(packageManager),
      id: `monorepo:${packageManager}`,
      neededBy: 'monorepo dependency bootstrap',
      wouldRun: installCommand(packageManager)
    });
  }

  return requirements;
}

function frontendRequirements(
  config: FrontendConfig,
  packageManager: PackageManager
): Requirement[] {
  const command = frontendScaffoldCommand(config.framework, packageManager);

  return command.executables.map((executable) => ({
    id: `frontend:${config.framework}:${executable}`,
    commands: commandAliases(executable),
    label: executable,
    neededBy: `${frameworkLabel(config.framework)} frontend setup`,
    wouldRun: command.command,
    fix: fixForCommand(executable)
  }));
}

function backendRequirements(config: BackendConfig): Requirement[] {
  const packageManager = config.packageManager ?? 'npm';

  switch (config.backendType) {
    case 'express':
      return [
        {
          ...packageManagerRequirement(packageManager),
          id: `backend:express:${packageManager}`,
          neededBy: 'Express backend dependency install',
          wouldRun: installCommand(packageManager)
        }
      ];

    case 'nestjs': {
      const executable = packageManager === 'bun' ? 'bun' : 'npx';

      return [
        packageManagerRequirement(packageManager),
        {
          id: `backend:nestjs:${executable}`,
          commands: commandAliases(executable),
          label: executable,
          neededBy: 'NestJS backend scaffold',
          wouldRun: `${packageManager === 'bun' ? 'bunx' : 'npx'} @nestjs/cli@latest new ${config.projectName} --package-manager ${packageManager} --skip-git`,
          fix: fixForCommand(executable)
        }
      ];
    }

    case 'fastapi':
      return [pythonRequirement('FastAPI backend setup')];

    case 'django':
      return [pythonRequirement('Django backend setup')];

    case 'springboot':
      return [
        {
          id: 'backend:springboot:java',
          commands: commandAliases('java'),
          label: 'Java runtime',
          neededBy: 'Spring Boot backend runtime',
          wouldRun: 'java --version',
          fix: 'Install JDK 21 or newer and make sure `java` is available in your PATH.'
        },
        {
          id: 'backend:springboot:jdk',
          commands: commandAliases('javac'),
          label: 'Java JDK',
          neededBy: 'Spring Boot backend compilation',
          wouldRun: 'javac --version',
          fix: 'Install JDK 21 or newer and make sure `javac` is available in your PATH.'
        },
        {
          id: 'backend:springboot:maven',
          commands: process.platform === 'win32' ? ['mvn.cmd', 'mvn'] : ['mvn'],
          label: 'Maven',
          neededBy: 'Spring Boot backend dependency resolution',
          wouldRun: 'mvn dependency:resolve',
          fix: 'Install Maven and make sure `mvn` is available in your PATH.'
        }
      ];
  }
}

function packageManagerRequirement(
  packageManager: PackageManager
): Requirement {
  return {
    id: `package-manager:${packageManager}`,
    commands: commandAliases(packageManager),
    label: packageManager,
    neededBy: `${packageManager} package manager commands`,
    wouldRun: installCommand(packageManager),
    fix: fixForCommand(packageManager)
  };
}

function pythonRequirement(neededBy: string): Requirement {
  return {
    id: `python:${neededBy}`,
    commands:
      process.platform === 'win32'
        ? ['py', 'python', 'python3']
        : ['python3', 'python'],
    label: 'Python',
    neededBy,
    wouldRun: 'python -m venv .venv',
    fix: 'Install Python 3 and make sure `python3`, `python`, or `py` is available in your PATH.'
  };
}

function frontendScaffoldCommand(
  framework: FrontendConfig['framework'],
  packageManager: PackageManager
) {
  switch (framework) {
    case 'next':
      return packageManager === 'bun'
        ? {
            command: 'bunx create-next-app@latest <project>',
            executables: ['bun']
          }
        : {
            command: 'npx create-next-app@latest <project>',
            executables: ['npx']
          };

    case 'angular':
      return packageManager === 'bun'
        ? {
            command: 'bunx @angular/cli@latest new <project>',
            executables: ['bun']
          }
        : {
            command: 'npx @angular/cli@latest new <project>',
            executables: ['npx']
          };

    case 'vue':
      return createCommand(packageManager, 'vue@latest');

    case 'vite':
      return createCommand(packageManager, 'vite@latest');

    case 'expo':
      return packageManager === 'bun'
        ? { command: 'bunx create-expo-app <project>', executables: ['bun'] }
        : { command: 'npx create-expo-app <project>', executables: ['npx'] };

    case 'react-native':
      return packageManager === 'bun'
        ? {
            command: 'bunx @react-native-community/cli init <project>',
            executables: ['bun']
          }
        : {
            command: 'npx @react-native-community/cli init <project>',
            executables: ['npx']
          };
  }
}

function createCommand(packageManager: PackageManager, initializer: string) {
  switch (packageManager) {
    case 'pnpm':
      return {
        command: `pnpm create ${initializer} <project>`,
        executables: ['pnpm']
      };
    case 'yarn':
      return {
        command: `yarn create ${initializer} <project>`,
        executables: ['yarn']
      };
    case 'bun':
      return {
        command: `bun create ${initializer} <project>`,
        executables: ['bun']
      };
    case 'npm':
      return {
        command: `npm create ${initializer} <project>`,
        executables: ['npm']
      };
  }
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

function findAvailableCommand(commands: string[]) {
  for (const command of commands) {
    try {
      execFileSync(command, ['--version'], { stdio: 'ignore' });
      return command;
    } catch {
      continue;
    }
  }

  return null;
}

function commandAliases(command: string): string[] {
  if (process.platform === 'win32') {
    return [`${command}.cmd`, command];
  }

  return [command];
}

function dedupeRequirements(requirements: Requirement[]) {
  const seen = new Set<string>();

  return requirements.filter((requirement) => {
    const key = requirement.commands.join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function frameworkLabel(framework: FrontendConfig['framework']) {
  switch (framework) {
    case 'next':
      return 'Next.js';
    case 'angular':
      return 'Angular';
    case 'vue':
      return 'Vue';
    case 'vite':
      return 'React (Vite)';
    case 'expo':
      return 'Expo';
    case 'react-native':
      return 'React Native CLI';
  }
}

function fixForCommand(command: string) {
  switch (command) {
    case 'npm':
    case 'npx':
      return 'Install Node.js 18+ from https://nodejs.org/ and make sure `npm` and `npx` are available in your PATH.';
    case 'pnpm':
      return 'Install pnpm with `npm install -g pnpm` or enable it with Corepack, then make sure `pnpm` is available in your PATH.';
    case 'yarn':
      return 'Install Yarn with `npm install -g yarn` or enable it with Corepack, then make sure `yarn` is available in your PATH.';
    case 'bun':
      return 'Install Bun from https://bun.sh/ and make sure `bun` is available in your PATH.';
    default:
      return `Install ${command} and make sure it is available in your PATH.`;
  }
}

function formatDoctorError(missing: MissingRequirement[]) {
  const lines = [
    'Doctor checks failed. The selected project cannot be initialized until these tools are available:',
    ''
  ];

  for (const requirement of missing) {
    lines.push(`- Missing ${requirement.label}`);
    lines.push(`  Needed by: ${requirement.neededBy}`);
    lines.push(`  Command that would fail: ${requirement.wouldRun}`);
    lines.push(`  Checked: ${requirement.checkedCommands.join(', ')}`);
    lines.push(`  Fix: ${requirement.fix}`);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function formatDoctorSuccess(requirements: CheckedRequirement[]) {
  const lines = ['✅ Doctor checks passed', ''];

  for (const requirement of requirements) {
    lines.push(
      `- ${requirement.label}: found \`${requirement.foundCommand}\` for ${requirement.neededBy}`
    );
  }

  return lines.join('\n');
}
