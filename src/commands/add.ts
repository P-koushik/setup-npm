import inquirer from 'inquirer';
import { addFeature } from '../engine/addBuilder.js';
import { buildAppIntegration } from '../engine/appBuilder.js';
import { AddConfig } from '../types/add-config.js';
import { AppConfig } from '../types/app-config.js';

export async function add() {
  try {
    const parsedArgs = parseSelectionItems(process.argv.slice(3));
    const resolvedFromArgs = await resolvePendingTargets(parsedArgs);

    if (
      resolvedFromArgs.cicdFeatures ||
      resolvedFromArgs.appIntegrations.length > 0
    ) {
      await runSelections(
        resolvedFromArgs.cicdFeatures,
        resolvedFromArgs.appIntegrations
      );
      return;
    }

    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'items',
        message: 'Choose what to add:',
        choices: [
          { name: 'CI/CD pipeline', value: 'cicd' },
          { name: 'Slack notifications', value: 'slack' },
          { name: 'Discord notifications', value: 'discord' },
          { name: 'Linting', value: 'linting' },
          { name: 'Formatting', value: 'formatting' },
          { name: 'Git hooks', value: 'git-hooks' },
          { name: 'Firebase Auth', value: 'firebase-auth' },
          { name: 'Supabase', value: 'supabase' }
        ],
        validate: (input: string[]) =>
          input.length > 0 ? true : 'Select at least one item to add'
      }
    ]);

    const selections = await resolvePendingTargets(
      parseSelectionItems(answers.items as string[])
    );
    await runSelections(selections.cicdFeatures, selections.appIntegrations);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      console.log('\n❌ Operation cancelled by user\n');
      process.exit(0);
    }

    console.error('❌ Something went wrong:', error);
    process.exit(1);
  }
}

async function runSelections(
  cicdFeatures: AddConfig['features'] | null,
  appIntegrations: AppConfig[]
) {
  if (cicdFeatures && cicdFeatures.length > 0) {
    await addFeature({ features: cicdFeatures });
  }

  for (const integration of dedupeIntegrations(appIntegrations)) {
    await buildAppIntegration(integration);
  }
}

async function resolvePendingTargets(selection: ParsedSelection): Promise<{
  cicdFeatures: AddConfig['features'] | null;
  appIntegrations: AppConfig[];
}> {
  const appIntegrations = [...selection.appIntegrations];

  for (const provider of selection.pendingProviders) {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'target',
        message: `Choose target for ${providerLabel(provider)}:`,
        choices: [
          { name: 'Frontend', value: 'frontend' },
          { name: 'Backend', value: 'backend' }
        ]
      }
    ]);

    appIntegrations.push({
      provider,
      target: answer.target as AppConfig['target'],
      frontendPlatform:
        (provider === 'firebase-auth' || provider === 'supabase') &&
        answer.target === 'frontend'
          ? await askFrontendPlatform(provider)
          : undefined
    });
  }

  return {
    cicdFeatures: selection.cicdFeatures,
    appIntegrations
  };
}

function parseSelectionItems(items: string[]): ParsedSelection {
  const normalizedItems = new Set(items);
  const cicdItems = new Set<AddConfig['features'][number]>();
  const appIntegrations: AppConfig[] = [];
  const pendingProviders = new Set<AppConfig['provider']>();
  const hasFrontendFlag = normalizedItems.has('--frontend');
  const hasBackendFlag = normalizedItems.has('--backend');
  const hasWebFlag = normalizedItems.has('--web');
  const hasMobileFlag = normalizedItems.has('--mobile');

  if (normalizedItems.has('cicd')) {
    cicdItems.add('cicd');
  }

  if (normalizedItems.has('slack')) {
    cicdItems.add('cicd');
    cicdItems.add('slack');
  }

  if (normalizedItems.has('discord')) {
    cicdItems.add('cicd');
    cicdItems.add('discord');
  }

  if (normalizedItems.has('linting')) {
    cicdItems.add('linting');
  }

  if (normalizedItems.has('formatting')) {
    cicdItems.add('formatting');
  }

  if (normalizedItems.has('git-hooks')) {
    cicdItems.add('git-hooks');
  }

  registerProviderSelections(
    normalizedItems,
    'firebase-auth',
    hasFrontendFlag,
    hasBackendFlag,
    hasWebFlag,
    hasMobileFlag,
    appIntegrations,
    pendingProviders
  );

  registerProviderSelections(
    normalizedItems,
    'supabase',
    hasFrontendFlag,
    hasBackendFlag,
    hasWebFlag,
    hasMobileFlag,
    appIntegrations,
    pendingProviders
  );

  return {
    cicdFeatures: cicdItems.size > 0 ? Array.from(cicdItems) : null,
    appIntegrations,
    pendingProviders: Array.from(pendingProviders)
  };
}

function registerProviderSelections(
  items: Set<string>,
  provider: AppConfig['provider'],
  hasFrontendFlag: boolean,
  hasBackendFlag: boolean,
  hasWebFlag: boolean,
  hasMobileFlag: boolean,
  appIntegrations: AppConfig[],
  pendingProviders: Set<AppConfig['provider']>
) {
  if (items.has(`${provider}:frontend`)) {
    appIntegrations.push({ provider, target: 'frontend' });
  }

  if (items.has(`${provider}:backend`)) {
    appIntegrations.push({ provider, target: 'backend' });
  }

  if (!items.has(provider)) {
    return;
  }

  if (hasFrontendFlag && !hasBackendFlag) {
    appIntegrations.push({
      provider,
      target: 'frontend',
      frontendPlatform:
        provider === 'firebase-auth' || provider === 'supabase'
          ? inferFrontendPlatform(hasWebFlag, hasMobileFlag)
          : undefined
    });

    if (
      (provider === 'firebase-auth' || provider === 'supabase') &&
      !inferFrontendPlatform(hasWebFlag, hasMobileFlag)
    ) {
      pendingProviders.add(provider);
      appIntegrations.pop();
    }
    return;
  }

  if (hasBackendFlag && !hasFrontendFlag) {
    appIntegrations.push({ provider, target: 'backend' });
    return;
  }

  if (!items.has(`${provider}:frontend`) && !items.has(`${provider}:backend`)) {
    pendingProviders.add(provider);
  }
}

function dedupeIntegrations(appIntegrations: AppConfig[]): AppConfig[] {
  const seen = new Set<string>();

  return appIntegrations.filter((integration) => {
    const key = `${integration.provider}:${integration.target}:${integration.frontendPlatform ?? ''}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function providerLabel(provider: AppConfig['provider']): string {
  switch (provider) {
    case 'firebase-auth':
      return 'Firebase Auth';
    case 'supabase':
      return 'Supabase';
  }
}

async function askFrontendPlatform(
  provider: AppConfig['provider']
): Promise<AppConfig['frontendPlatform']> {
  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'frontendPlatform',
      message: `Choose frontend platform for ${providerLabel(provider)}:`,
      choices: [
        { name: 'Web', value: 'web' },
        { name: 'Mobile', value: 'mobile' }
      ]
    }
  ]);

  return answer.frontendPlatform as AppConfig['frontendPlatform'];
}

function inferFrontendPlatform(
  hasWebFlag: boolean,
  hasMobileFlag: boolean
): AppConfig['frontendPlatform'] {
  if (hasWebFlag && !hasMobileFlag) {
    return 'web';
  }

  if (hasMobileFlag && !hasWebFlag) {
    return 'mobile';
  }

  return undefined;
}

type ParsedSelection = {
  cicdFeatures: AddConfig['features'] | null;
  appIntegrations: AppConfig[];
  pendingProviders: AppConfig['provider'][];
};
