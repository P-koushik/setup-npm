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
      target: answer.target as AppConfig['target']
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

  registerProviderSelections(
    normalizedItems,
    'firebase-auth',
    hasFrontendFlag,
    hasBackendFlag,
    appIntegrations,
    pendingProviders
  );

  registerProviderSelections(
    normalizedItems,
    'supabase',
    hasFrontendFlag,
    hasBackendFlag,
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
    appIntegrations.push({ provider, target: 'frontend' });
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
    const key = `${integration.provider}:${integration.target}`;

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

type ParsedSelection = {
  cicdFeatures: AddConfig['features'] | null;
  appIntegrations: AppConfig[];
  pendingProviders: AppConfig['provider'][];
};
