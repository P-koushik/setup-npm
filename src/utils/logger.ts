import chalk from 'chalk';
import ora, { Ora } from 'ora';

export function createSpinner(text: string): Ora {
  return ora(text).start();
}

export function info(message: string) {
  console.log(chalk.cyan(message));
}

export function success(message: string) {
  console.log(chalk.green(`✔ ${message}`));
}

export function failure(message: string) {
  console.log(chalk.red(`✖ ${message}`));
}

export function step(message: string) {
  console.log(`\n${chalk.blue('▶')} ${message}`);
}

export function fixList(fixes: string[]) {
  if (fixes.length === 0) {
    return;
  }

  console.log('\nFix:');
  for (const item of fixes) {
    console.log(`- ${item}`);
  }
}
