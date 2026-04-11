import inquirer from 'inquirer';

export async function init() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Enter project name:'
    }
  ]);

  console.log(`Creating project: ${answers.projectName}`);
}
