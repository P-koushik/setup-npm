import inquirer, { Answers, DistinctQuestion } from 'inquirer';
import CheckboxPrompt from 'inquirer/lib/prompts/checkbox.js';
import ConfirmPrompt from 'inquirer/lib/prompts/confirm.js';
import ListPrompt from 'inquirer/lib/prompts/list.js';

const promptBack = Symbol('promptBack');

type NavigableQuestion<T extends Answers> = DistinctQuestion<T> & {
  name: keyof T & string;
};

type NavigationPrompt = {
  rl: {
    emit(event: 'line', input: string): boolean;
    input?: NodeJS.ReadStream;
    line?: string;
  };
  screen: {
    done(): void;
  };
  opt?: {
    canGoBack?: boolean;
  };
  removeNavigationListener?: () => void;
  done?: (value: unknown) => void;
};

export function requireSelection<T>(value: T[]): true | string {
  return value.length > 0
    ? true
    : 'Select at least one option, or press Esc or Ctrl+C to exit.';
}

export async function promptWithNavigation<T extends Answers>(
  questions: Array<NavigableQuestion<T>>,
  initialAnswers: Partial<T> = {}
): Promise<T> {
  const prompt = createNavigablePrompt();
  const answers = { ...initialAnswers } as T;
  let index = 0;
  let direction: 'forward' | 'back' = 'forward';

  while (index < questions.length) {
    const question = questions[index];

    if (!(await shouldAsk(question, answers))) {
      if (direction === 'back' && index === 0) {
        direction = 'forward';
      }

      index += direction === 'forward' ? 1 : -1;
      index = Math.max(index, 0);
      continue;
    }

    const answer = await prompt<T>(
      [
        {
          ...question,
          askAnswered: true,
          canGoBack: await hasPreviousQuestion(questions, answers, index),
          default:
            answers[question.name] === undefined
              ? question.default
              : answers[question.name]
        }
      ],
      answers
    );
    const value = answer[question.name];

    if (value === promptBack) {
      deleteFollowingAnswers(answers, questions, index);
      index = Math.max(index - 1, 0);
      direction = 'back';
      continue;
    }

    const previousValue = answers[question.name];
    answers[question.name] = value;

    if (previousValue !== undefined && previousValue !== value) {
      deleteFollowingAnswers(answers, questions, index + 1);
    }

    index += 1;
    direction = 'forward';
  }

  return answers;
}

function createNavigablePrompt() {
  const prompt = inquirer.createPromptModule();

  prompt.registerPrompt('list', NavigableListPrompt);
  prompt.registerPrompt('checkbox', NavigableCheckboxPrompt);
  prompt.registerPrompt('confirm', NavigableConfirmPrompt);

  return prompt;
}

class NavigableListPrompt extends ListPrompt {
  _run(callback: (value: unknown) => void) {
    const prompt = this as unknown as NavigationPrompt;
    super._run(wrapNavigation(prompt, callback));
    attachNavigation(prompt);
    return this;
  }
}

class NavigableCheckboxPrompt extends CheckboxPrompt {
  _run(callback: (value: unknown) => void) {
    const prompt = this as unknown as NavigationPrompt;
    super._run(wrapNavigation(prompt, callback));
    attachNavigation(prompt);
    return this;
  }
}

class NavigableConfirmPrompt extends ConfirmPrompt {
  _run(callback: (value: unknown) => void) {
    const prompt = this as unknown as NavigationPrompt;
    super._run(wrapNavigation(prompt, callback));
    attachNavigation(prompt);
    return this;
  }
}

function wrapNavigation(
  prompt: NavigationPrompt,
  callback: (value: unknown) => void
) {
  return (value: unknown) => {
    prompt.removeNavigationListener?.();
    callback(value);
  };
}

function attachNavigation(prompt: NavigationPrompt) {
  const input = prompt.rl.input;

  if (!input) {
    return;
  }

  const onKeypress = (_value: string, key?: { name?: string }) => {
    if (key?.name === 'right') {
      prompt.rl.emit('line', prompt.rl.line ?? '');
      return;
    }

    if (key?.name !== 'left') {
      return;
    }

    if (!prompt.opt?.canGoBack) {
      return;
    }

    prompt.removeNavigationListener?.();
    prompt.screen.done();
    prompt.done?.(promptBack);
  };

  input.on('keypress', onKeypress);
  prompt.removeNavigationListener = () => {
    input.off('keypress', onKeypress);
  };
}

async function shouldAsk<T extends Answers>(
  question: NavigableQuestion<T>,
  answers: T
) {
  if (question.when === false) {
    return false;
  }

  if (typeof question.when !== 'function') {
    return true;
  }

  return question.when(answers);
}

async function hasPreviousQuestion<T extends Answers>(
  questions: Array<NavigableQuestion<T>>,
  answers: T,
  currentIndex: number
) {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (await shouldAsk(questions[index], answers)) {
      return true;
    }
  }

  return false;
}

function deleteFollowingAnswers<T extends Answers>(
  answers: T,
  questions: Array<NavigableQuestion<T>>,
  startIndex: number
) {
  for (const question of questions.slice(startIndex)) {
    Reflect.deleteProperty(answers, question.name);
  }
}
