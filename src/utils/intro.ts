import chalk from 'chalk';

const setupForgeBanner = [
  ' ____       _               _____                         ',
  '/ ___|  ___| |_ _   _ _ __ |  ___|__  _ __ __ _  ___     ',
  '\\___ \\ / _ \\ __| | | |  _ \\| |_ / _ \\|  __/ _` |/ _ \\    ',
  ' ___) |  __/ |_| |_| | |_) |  _| (_) | | | (_| |  __/    ',
  '|____/ \\___|\\__|\\__,_| .__/|_|  \\___/|_|  \\__, |\\___|    ',
  '                     |_|                  |___/           '
];

export type SummaryEntry = {
  label: string;
  value: string;
};

export function printProjectIntro(message: string) {
  const width = getFrameWidth();
  const versionText = `Node ${process.version}`;

  console.log('');
  console.log(chalk.cyan.bold('SetupForge') + chalk.gray(`  ${versionText}`));
  console.log(chalk.gray('─'.repeat(width)));
  console.log('');

  for (const line of setupForgeBanner) {
    console.log(chalk.cyan(line));
  }

  console.log('');
  console.log(chalk.magenta('◆ ') + chalk.white.bold(message));
  console.log(
    chalk.gray(
      'Answer a few questions and SetupForge will prepare the project.'
    )
  );
  console.log('');
}

export function printConfigurationSummary(entries: SummaryEntry[]) {
  const width = Math.min(getFrameWidth(), 88);
  const contentWidth = width - 4;

  console.log('');
  console.log(chalk.cyan('┌' + '─'.repeat(width - 2) + '┐'));
  console.log(
    chalk.cyan('│ ') +
      chalk.white.bold('Configuration summary'.padEnd(contentWidth)) +
      chalk.cyan(' │')
  );
  console.log(chalk.cyan('├' + '─'.repeat(width - 2) + '┤'));

  for (const entry of entries) {
    const label = `${entry.label}:`;
    const value = entry.value;
    const visibleLength = label.length + 1 + value.length;

    console.log(
      chalk.cyan('│ ') +
        chalk.gray(label) +
        ' ' +
        chalk.white(value) +
        ' '.repeat(Math.max(contentWidth - visibleLength, 0)) +
        chalk.cyan(' │')
    );
  }

  console.log(chalk.cyan('└' + '─'.repeat(width - 2) + '┘'));
  console.log('');
}

function getFrameWidth() {
  return Math.max(Math.min(process.stdout.columns || 88, 110), 72);
}
