import inquirer from 'inquirer';
import { buildBackend } from '../engine/backendBuilder.js';
import { BackendConfig } from '../types/backend-config.js';

export async function backend() {
  try {
    const baseAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        validate: (input: string) => (input ? true : 'Project name is required')
      },
      {
        type: 'list',
        name: 'backendType',
        message: 'Choose backend type:',
        choices: [
          { name: 'Express', value: 'express' },
          { name: 'NestJS', value: 'nestjs' },
          { name: 'FastAPI', value: 'fastapi' },
          { name: 'Django', value: 'django' },
          { name: 'Spring Boot', value: 'springboot' }
        ],
        default: 'express'
      }
    ]);

    let backendAnswers = {};

    if (baseAnswers.backendType === 'express') {
      backendAnswers = await inquirer.prompt([
        {
          type: 'list',
          name: 'language',
          message: 'Choose language:',
          choices: [
            { name: 'TypeScript (recommended)', value: 'TypeScript' },
            { name: 'JavaScript', value: 'JavaScript' }
          ],
          default: 'TypeScript'
        },
        {
          type: 'confirm',
          name: 'useMongo',
          message: 'Use MongoDB?',
          default: true
        }
      ]);
    }

    await buildBackend({
      ...baseAnswers,
      ...backendAnswers
    } as BackendConfig);
  } catch (error: unknown) {
    // ✅ Handle Ctrl+C gracefully
    if (error instanceof Error && error.name === 'ExitPromptError') {
      console.log('\n❌ Operation cancelled by user\n');
      process.exit(0);
    }

    // ❌ Unknown error
    console.error('❌ Something went wrong:', error);
    process.exit(1);
  }
}
