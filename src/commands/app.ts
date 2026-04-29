import { runPlugin } from '../engine/plugin-runner/index.js';
import { AppConfig } from '../types/app-config.js';
import { promptWithNavigation } from '../utils/prompt.js';

export async function app(preset?: Record<string, unknown>) {
  try {
    const config = await resolveAppConfig(preset);
    await runPlugin(config.provider, {
      target: config.target,
      frontendPlatform: config.frontendPlatform
    });
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

  const answers = await promptWithNavigation<AppConfig>(
    [
      {
        type: 'list',
        name: 'provider',
        message: 'Choose app integration:',
        choices: [
          { name: 'Firebase Auth', value: 'firebase-auth' },
          { name: 'Supabase', value: 'supabase' }
        ],
        when: () => !provider
      },
      {
        type: 'list',
        name: 'target',
        message: 'Choose integration target:',
        choices: [
          { name: 'Frontend', value: 'frontend' },
          { name: 'Backend', value: 'backend' }
        ],
        when: () => !target
      },
      {
        type: 'list',
        name: 'frontendPlatform',
        message: 'Choose frontend platform:',
        choices: [
          { name: 'Web', value: 'web' },
          { name: 'Mobile', value: 'mobile' }
        ],
        when: (currentAnswers) =>
          (currentAnswers.provider === 'firebase-auth' ||
            currentAnswers.provider === 'supabase') &&
          currentAnswers.target === 'frontend' &&
          !frontendPlatform
      }
    ],
    {
      provider,
      target,
      frontendPlatform
    }
  );

  provider = answers.provider;
  target = answers.target;
  frontendPlatform = answers.frontendPlatform;

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
