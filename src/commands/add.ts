import inquirer from 'inquirer';
import { addFeature } from '../engine/addBuilder.js';
import { buildAppIntegration } from '../engine/appBuilder.js';
import { AddConfig } from '../types/add-config.js';
import { AppConfig } from '../types/app-config.js';
import {
  beginRun,
  clearRun,
  completeStep,
  failStep,
  loadState,
  updateProjectConfig
} from '../utils/state.js';

export async function add(preset?: Record<string, unknown>) {
  try {
    const parsedArgs = preset
      ? {
          cicdFeatures:
            (preset.cicdFeatures as AddConfig['features'] | null) ?? null,
          appIntegrations: (preset.appIntegrations as AppConfig[]) ?? [],
          pendingProviders: []
        }
      : parseSelectionItems(process.argv.slice(3));
    const resolved = await resolvePendingTargets(parsedArgs);

    if (!resolved.cicdFeatures && resolved.appIntegrations.length === 0) {
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

      const interactive = await resolvePendingTargets(
        parseSelectionItems(answers.items as string[])
      );
      await runSelections(
        interactive.cicdFeatures,
        interactive.appIntegrations
      );
      return;
    }

    await runSelections(resolved.cicdFeatures, resolved.appIntegrations);
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
  const features = cicdFeatures ?? [];
  const integrations = dedupeIntegrations(appIntegrations);
  const existingState = await loadState(process.cwd());

  if (!existingState) {
    await beginRun(process.cwd(), {
      command: 'add',
      projectPath: process.cwd(),
      input: {
        cicdFeatures,
        appIntegrations: integrations
      },
      steps: [
        ...features.map((feature) => ({
          id: `feature:${feature}`,
          status: 'pending' as const
        })),
        ...integrations.map((integration) => ({
          id: integrationStepId(integration),
          status: 'pending' as const
        }))
      ]
    });
  }

  if (features.length > 0) {
    try {
      await addFeature({ features });
      for (const feature of features) {
        await completeStep(process.cwd(), `feature:${feature}`);
      }
    } catch {
      for (const feature of features) {
        await failStep(process.cwd(), `feature:${feature}`);
      }
      throw new Error('Feature add failed');
    }
  }

  for (const integration of integrations) {
    const stepId = integrationStepId(integration);

    if (
      existingState?.steps.some(
        (step) => step.id === stepId && step.status === 'completed'
      )
    ) {
      continue;
    }

    try {
      await buildAppIntegration(integration);
      await completeStep(process.cwd(), stepId);
    } catch {
      await failStep(process.cwd(), stepId);
      throw new Error('Integration add failed');
    }
  }

  await updateProjectConfig(process.cwd(), {
    features: [
      ...features,
      ...integrations.map((integration) => integration.provider)
    ]
  });
  await clearRun(process.cwd());
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
          ? ((await askFrontendPlatform(
              provider
            )) as AppConfig['frontendPlatform'])
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

  for (const feature of [
    'cicd',
    'linting',
    'formatting',
    'git-hooks'
  ] as const) {
    if (normalizedItems.has(feature)) {
      cicdItems.add(feature);
    }
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
    const frontendPlatform =
      provider === 'firebase-auth' || provider === 'supabase'
        ? inferFrontendPlatform(hasWebFlag, hasMobileFlag)
        : undefined;

    if (
      (provider === 'firebase-auth' || provider === 'supabase') &&
      !frontendPlatform
    ) {
      pendingProviders.add(provider);
      return;
    }

    appIntegrations.push({
      provider,
      target: 'frontend',
      frontendPlatform
    });
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
    const key = integrationStepId(integration);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function providerLabel(provider: AppConfig['provider']): string {
  return provider === 'firebase-auth' ? 'Firebase Auth' : 'Supabase';
}

async function askFrontendPlatform(
  provider: AppConfig['provider']
): Promise<AppConfig['frontendPlatform']> {
  return (
    await inquirer.prompt([
      {
        type: 'list',
        name: 'frontendPlatform',
        message: `Choose frontend platform for ${providerLabel(provider)}:`,
        choices: [
          { name: 'Web', value: 'web' },
          { name: 'Mobile', value: 'mobile' }
        ]
      }
    ])
  ).frontendPlatform as AppConfig['frontendPlatform'];
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

function integrationStepId(integration: AppConfig): string {
  return `integration:${integration.provider}:${integration.target}:${integration.frontendPlatform ?? ''}`;
}

type ParsedSelection = {
  cicdFeatures: AddConfig['features'] | null;
  appIntegrations: AppConfig[];
  pendingProviders: AppConfig['provider'][];
};
