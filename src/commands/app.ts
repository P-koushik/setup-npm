import inquirer from 'inquirer';
import { buildAppIntegration } from '../engine/appBuilder.js';
import { AppConfig } from '../types/app-config.js';

export async function app() {
  try {
    const args = process.argv.slice(3);
    const providerArg = args.find((arg) => !arg.startsWith('--'));
    const hasFrontendFlag = args.includes('--frontend');
    const hasBackendFlag = args.includes('--backend');

    let provider = normalizeProvider(providerArg);
    let target: AppConfig['target'] | undefined;

    if (hasFrontendFlag && !hasBackendFlag) {
      target = 'frontend';
    }

    if (hasBackendFlag && !hasFrontendFlag) {
      target = 'backend';
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

    if (!provider || !target) {
      throw new Error('Provider and target are required');
    }

    await buildAppIntegration({
      provider,
      target
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
