import inquirer from 'inquirer';
import { buildAppIntegration } from '../engine/appBuilder.js';
import { AppConfig } from '../types/app-config.js';

export async function app() {
  try {
    const args = process.argv.slice(3);
    const providerArg = args.find((arg) => !arg.startsWith('--'));
    const hasFrontendFlag = args.includes('--frontend');
    const hasBackendFlag = args.includes('--backend');
    const hasWebFlag = args.includes('--web');
    const hasMobileFlag = args.includes('--mobile');

    let provider = normalizeProvider(providerArg);
    let target: AppConfig['target'] | undefined;
    let frontendPlatform: AppConfig['frontendPlatform'];

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
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message: 'Choose app integration:',
          choices: [
            { name: 'Firebase Auth', value: 'firebase-auth' },
            { name: 'Supabase', value: 'supabase' }
          ]
        }
      ]);

      provider = answer.provider;
    }

    if (!target) {
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'target',
          message: 'Choose integration target:',
          choices: [
            { name: 'Frontend', value: 'frontend' },
            { name: 'Backend', value: 'backend' }
          ]
        }
      ]);

      target = answer.target;
    }

    if (
      (provider === 'firebase-auth' || provider === 'supabase') &&
      target === 'frontend' &&
      !frontendPlatform
    ) {
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'frontendPlatform',
          message: 'Choose frontend platform:',
          choices: [
            { name: 'Web', value: 'web' },
            { name: 'Mobile', value: 'mobile' }
          ]
        }
      ]);

      frontendPlatform = answer.frontendPlatform;
    }

    if (!provider || !target) {
      throw new Error('Provider and target are required');
    }

    await buildAppIntegration({
      provider,
      target,
      frontendPlatform
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

function normalizeProvider(value?: string): AppConfig['provider'] | undefined {
  if (value === 'firebase-auth' || value === 'supabase') {
    return value;
  }

  return undefined;
}
