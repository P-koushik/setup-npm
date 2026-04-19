import inquirer from 'inquirer';
import { buildFrontend } from '../engine/frontendBuilder.js';

export async function frontend() {
  try {
    const { platform } = await inquirer.prompt([
      {
        type: 'list',
        name: 'platform',
        message: 'Choose platform:',
        choices: [
          { name: 'Web 🌐', value: 'web' },
          { name: 'Native 📱', value: 'native' }
        ]
      }
    ]);

    let frameworkAnswer;

    if (platform === 'web') {
      frameworkAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'framework',
          message: 'Choose framework:',
          choices: [
            { name: 'Next.js (recommended)', value: 'next' },
            { name: 'Angular', value: 'angular' },
            { name: 'Vue', value: 'vue' },
            { name: 'React (Vite)', value: 'vite' }
          ]
        }
      ]);
    } else {
      frameworkAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'framework',
          message: 'Choose framework:',
          choices: [
            { name: 'Expo (recommended)', value: 'expo' },
            { name: 'React Native CLI', value: 'react-native' }
          ]
        }
      ]);
    }

    const { projectName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        validate: (input) => (input ? true : 'Project name is required')
      }
    ]);

    await buildFrontend({
      platform,
      framework: frameworkAnswer.framework,
      projectName
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
