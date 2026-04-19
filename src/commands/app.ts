import inquirer from 'inquirer';
import { buildAppIntegration } from '../engine/appBuilder.js';
import { AppConfig } from '../types/app-config.js';
import {
  beginRun,
  clearRun,
  completeStep,
  failStep,
  updateProjectConfig
} from '../utils/state.js';

export async function app(preset?: Record<string, unknown>) {
  try {
    const config = await resolveAppConfig(preset);

    await beginRun(process.cwd(), {
      command: 'app',
      projectPath: process.cwd(),
      input: config as unknown as Record<string, unknown>,
      steps: [{ id: 'apply-app-integration', status: 'pending' }]
    });

    try {
      await buildAppIntegration(config);
      await completeStep(process.cwd(), 'apply-app-integration');
    } catch {
      await failStep(process.cwd(), 'apply-app-integration');
      throw new Error('App integration failed');
    }

    await updateProjectConfig(process.cwd(), {
      features: [config.provider]
    });
    await clearRun(process.cwd());
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      console.log('\n❌ Operation cancelled by user\n');
      process.exit(0);
    }

    console.error('❌ Something went wrong:', error);
    process.exit(1);
  }
}

async function resolveAppConfig(
  preset?: Record<string, unknown>
): Promise<AppConfig> {
  const args = preset ? [] : process.argv.slice(3);
  const providerArg = args.find((arg) => !arg.startsWith('--'));
  const hasFrontendFlag = args.includes('--frontend');
  const hasBackendFlag = args.includes('--backend');
  const hasWebFlag = args.includes('--web');
  const hasMobileFlag = args.includes('--mobile');

  let provider = normalizeProvider(
    typeof preset?.provider === 'string' ? preset.provider : providerArg
  );
  let target: AppConfig['target'] | undefined =
    typeof preset?.target === 'string'
      ? (preset.target as AppConfig['target'])
      : undefined;
  let frontendPlatform: AppConfig['frontendPlatform'] =
    typeof preset?.frontendPlatform === 'string'
      ? (preset.frontendPlatform as AppConfig['frontendPlatform'])
      : undefined;

  if (hasFrontendFlag && !hasBackendFlag) {
    target = 'frontend';
  }

  if (hasBackendFlag && !hasFrontendFlag) {
    target = 'backend';
  }

  if (hasWebFlag && !hasMobileFlag) {
    target = 'frontend';
    frontendPlatform = 'web';
  }

  if (hasMobileFlag && !hasWebFlag) {
    target = 'frontend';
    frontendPlatform = 'mobile';
  }

  if (!provider) {
    provider = (
      await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message: 'Choose app integration:',
          choices: [
            { name: 'Firebase Auth', value: 'firebase-auth' },
            { name: 'Supabase', value: 'supabase' }
          ]
        }
      ])
    ).provider;
  }

  if (!target) {
    target = (
      await inquirer.prompt([
        {
          type: 'list',
          name: 'target',
          message: 'Choose integration target:',
          choices: [
            { name: 'Frontend', value: 'frontend' },
            { name: 'Backend', value: 'backend' }
          ]
        }
      ])
    ).target;
  }

  if (
    (provider === 'firebase-auth' || provider === 'supabase') &&
    target === 'frontend' &&
    !frontendPlatform
  ) {
    frontendPlatform = (
      await inquirer.prompt([
        {
          type: 'list',
          name: 'frontendPlatform',
          message: 'Choose frontend platform:',
          choices: [
            { name: 'Web', value: 'web' },
            { name: 'Mobile', value: 'mobile' }
          ]
        }
      ])
    ).frontendPlatform;
  }

  if (!provider || !target) {
    throw new Error('Provider and target are required');
  }

  return {
    provider,
    target,
    frontendPlatform
  };
}

function normalizeProvider(value?: string): AppConfig['provider'] | undefined {
  if (value === 'firebase-auth' || value === 'supabase') {
    return value;
  }

  return undefined;
}
