import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import inquirer from 'inquirer';

const fallbackPackageName = 'setupforge';
const fallbackVersion = '1.0.3';

type UpdateChoice = 'update' | 'continue';

export function getInstalledPackageInfo() {
  return readPackageInfo();
}

export async function checkForUpdates() {
  if (process.env.SETUPFORGE_SKIP_UPDATE_CHECK === '1') {
    return;
  }

  const packageInfo = getInstalledPackageInfo();
  const latestVersion = getLatestVersion(packageInfo.name);

  if (!latestVersion || !isNewerVersion(latestVersion, packageInfo.version)) {
    return;
  }

  console.log('');
  console.log(
    chalk.cyan('Update available:') +
      ` ${packageInfo.name} ${chalk.gray(packageInfo.version)} -> ${chalk.green(latestVersion)}`
  );

  const { choice } = await inquirer.prompt<{ choice: UpdateChoice }>([
    {
      type: 'list',
      name: 'choice',
      message:
        'A newer version of SetupForge is available. What do you want to do?',
      choices: [
        { name: 'Update now', value: 'update' },
        { name: 'Continue without updating', value: 'continue' }
      ],
      default: 'update'
    }
  ]);

  if (choice === 'continue') {
    console.log(chalk.gray('Continuing without updating.\n'));
    return;
  }

  installLatestVersion(packageInfo.name);
  console.log(
    chalk.green(
      '\nSetupForge updated. Run `setupforge` again to use the latest version.\n'
    )
  );
  process.exit(0);
}

function readPackageInfo() {
  const candidates = [
    new URL('../package.json', import.meta.url),
    new URL('../../package.json', import.meta.url)
  ];

  for (const candidate of candidates) {
    try {
      const packageJson = JSON.parse(
        readFileSync(fileURLToPath(candidate), 'utf8')
      ) as { name?: string; version?: string };

      return {
        name: packageJson.name ?? fallbackPackageName,
        version: packageJson.version ?? fallbackVersion
      };
    } catch {
      continue;
    }
  }

  return {
    name: fallbackPackageName,
    version: fallbackVersion
  };
}

function getLatestVersion(packageName: string) {
  try {
    return execFileSync('npm', ['view', `${packageName}@latest`, 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000
    }).trim();
  } catch {
    return null;
  }
}

function installLatestVersion(packageName: string) {
  try {
    execFileSync('npm', ['install', '-g', `${packageName}@latest`], {
      stdio: 'inherit'
    });
  } catch {
    throw new Error(
      `Update failed. Try running \`npm install -g ${packageName}@latest\` manually.`
    );
  }
}

function isNewerVersion(latestVersion: string, installedVersion: string) {
  const latest = parseVersion(latestVersion);
  const installed = parseVersion(installedVersion);

  for (let index = 0; index < latest.length; index += 1) {
    if (latest[index] > installed[index]) {
      return true;
    }

    if (latest[index] < installed[index]) {
      return false;
    }
  }

  return false;
}

function parseVersion(version: string) {
  return version
    .split('.')
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}
