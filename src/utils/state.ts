import fs from 'fs-extra';
import path from 'path';

export type RuntimeState = {
  command: 'init' | 'frontend' | 'backend' | 'add' | 'app';
  projectPath: string;
  input: Record<string, unknown>;
  steps: Array<{
    id: string;
    status: 'pending' | 'completed' | 'failed';
  }>;
  failedStep?: string;
};

export async function beginRun(basePath: string, state: RuntimeState) {
  await writeState(basePath, state);
}

export async function completeStep(basePath: string, stepId: string) {
  const state = await loadState(basePath);

  if (!state) {
    return;
  }

  state.steps = state.steps.map((step) =>
    step.id === stepId ? { ...step, status: 'completed' } : step
  );
  if (state.failedStep === stepId) {
    delete state.failedStep;
  }

  await writeState(basePath, state);
}

export async function failStep(basePath: string, stepId: string) {
  const state = await loadState(basePath);

  if (!state) {
    return;
  }

  state.steps = state.steps.map((step) =>
    step.id === stepId ? { ...step, status: 'failed' } : step
  );
  state.failedStep = stepId;

  await writeState(basePath, state);
}

export async function clearRun(basePath: string) {
  const filePath = stateFilePath(basePath);

  if (await fs.pathExists(filePath)) {
    await fs.remove(filePath);
  }
}

export async function loadState(
  basePath: string
): Promise<RuntimeState | null> {
  const filePath = stateFilePath(basePath);

  if (!(await fs.pathExists(filePath))) {
    return null;
  }

  return (await fs.readJson(filePath)) as RuntimeState;
}

export async function updateProjectConfig(
  projectPath: string,
  value: Record<string, unknown>
) {
  const filePath = path.join(projectPath, '.setuprc');
  const current = (await fs.pathExists(filePath))
    ? ((await fs.readJson(filePath)) as Record<string, unknown>)
    : {};

  await fs.writeJson(
    filePath,
    {
      ...current,
      ...value
    },
    { spaces: 2 }
  );
}

function stateFilePath(basePath: string): string {
  return path.join(basePath, '.setup', 'state.json');
}

async function writeState(basePath: string, state: RuntimeState) {
  const filePath = stateFilePath(basePath);
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, state, { spaces: 2 });
}
