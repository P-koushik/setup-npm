import { runDoctor } from '../doctor/index.js';
import { hasCommand } from '../../utils/env.js';
import { failure, fixList, success } from '../../utils/logger.js';

export async function ensureNodePreflight() {
  const ok = await runDoctor('node');

  if (!ok) {
    throw new Error('Node environment checks failed');
  }
}

export async function ensureAndroidPreflight() {
  const ok = await runDoctor('android');

  if (!ok) {
    throw new Error('Android environment checks failed');
  }
}

export async function ensurePythonPreflight() {
  if (hasCommand('python3') || hasCommand('python')) {
    success('Python available');
    return;
  }

  failure('Python available');
  fixList(['Install Python 3', 'Add python3 to PATH']);
  throw new Error('Python environment checks failed');
}

export async function ensureJavaPreflight() {
  if (hasCommand('java')) {
    success('Java available');
    return;
  }

  failure('Java available');
  fixList(['Install Java 21 or newer', 'Add Java to PATH']);
  throw new Error('Java environment checks failed');
}
