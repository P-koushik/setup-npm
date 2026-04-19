import inquirer from 'inquirer';
import { addFeature } from '../engine/addBuilder.js';
import { AddConfig } from '../types/add-config.js';

export async function add() {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'features',
        message: 'Choose what to add:',
        choices: [
          { name: 'CI/CD pipeline', value: 'cicd' },
          { name: 'Slack notifications', value: 'slack' },
          { name: 'Discord notifications', value: 'discord' }
        ],
        validate: (input: string[]) =>
          input.length > 0 ? true : 'Select at least one item to add'
      }
    ]);

    const normalizedFeatures = Array.from(
      new Set(
        answers.features.some(
          (feature: string) => feature === 'slack' || feature === 'discord'
        )
          ? [...answers.features, 'cicd']
          : answers.features
      )
    );

    await addFeature({
      features: normalizedFeatures as AddConfig['features']
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
