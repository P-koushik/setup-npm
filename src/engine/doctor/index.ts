import {
  androidSdkExists,
  getNodeVersion,
  hasCommand,
  isNodeVersionSupported
} from '../../utils/env.js';
import { failure, fixList, success } from '../../utils/logger.js';

export type DoctorTarget = 'node' | 'android' | 'backend';

type DoctorCheck = {
  label: string;
  ok: boolean;
  fixes?: string[];
};

export async function runDoctor(target?: DoctorTarget): Promise<boolean> {
  const targets = target
    ? [target]
    : (['node', 'android', 'backend'] as DoctorTarget[]);
  let hasErrors = false;

  for (const currentTarget of targets) {
    const checks = await getChecks(currentTarget);

    for (const check of checks) {
      if (check.ok) {
        success(check.label);
        continue;
      }

      hasErrors = true;
      failure(check.label);
      fixList(check.fixes ?? []);
      console.log('');
    }
  }

  return !hasErrors;
}

async function getChecks(target: DoctorTarget): Promise<DoctorCheck[]> {
  switch (target) {
    case 'node':
      return getNodeChecks();
    case 'android':
      return getAndroidChecks();
    case 'backend':
      return getBackendChecks();
  }
}

function getNodeChecks(): DoctorCheck[] {
  const nodeVersion = getNodeVersion();

  return [
    {
      label:
        nodeVersion && isNodeVersionSupported(nodeVersion)
          ? `Node version OK (${nodeVersion})`
          : 'Node version >= 18 required',
      ok: isNodeVersionSupported(nodeVersion),
      fixes: [
        'Install Node.js 18 or newer',
        'Restart your shell after upgrading Node.js'
      ]
    },
    {
      label: 'npm available',
      ok: hasCommand('npm'),
      fixes: ['Install Node.js with npm']
    },
    {
      label: 'pnpm available',
      ok: hasCommand('pnpm'),
      fixes: ['Install pnpm globally: npm install -g pnpm']
    },
    {
      label: 'yarn available',
      ok: hasCommand('yarn'),
      fixes: ['Install Yarn globally: npm install -g yarn']
    }
  ];
}

async function getAndroidChecks(): Promise<DoctorCheck[]> {
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

  return [
    {
      label: 'ANDROID_HOME is set',
      ok: Boolean(androidHome),
      fixes: [
        'Install Android Studio',
        'Set ANDROID_HOME or ANDROID_SDK_ROOT to your SDK path'
      ]
    },
    {
      label: 'Android SDK directory exists',
      ok: await androidSdkExists(),
      fixes: [
        'Install Android SDK from Android Studio',
        'Verify the SDK path exists on disk'
      ]
    },
    {
      label: 'adb command available',
      ok: hasCommand('adb'),
      fixes: ['Install Android platform-tools', 'Add platform-tools to PATH']
    },
    {
      label: 'emulator command available',
      ok: hasCommand('emulator'),
      fixes: [
        'Install Android emulator tools',
        'Add Android emulator tools to PATH'
      ]
    }
  ];
}

function getBackendChecks(): DoctorCheck[] {
  return [
    {
      label: 'Python available',
      ok: hasCommand('python3') || hasCommand('python'),
      fixes: ['Install Python 3', 'Add python3 to PATH']
    },
    {
      label: 'Java available',
      ok: hasCommand('java'),
      fixes: ['Install Java 21 or newer', 'Add Java to PATH']
    }
  ];
}
