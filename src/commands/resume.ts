import { add } from './add.js';
import { app } from './app.js';
import { backend } from './backend.js';
import { frontend } from './frontend.js';
import { init } from './init.js';
import { loadState } from '../utils/state.js';

export async function resume() {
  const state = await loadState(process.cwd());

  if (!state) {
    console.log('No resumable setup state found.');
    return;
  }

  switch (state.command) {
    case 'init':
      await init(state.input as Record<string, unknown>);
      return;
    case 'frontend':
      await frontend(state.input as Record<string, unknown>);
      return;
    case 'backend':
      await backend(state.input as Record<string, unknown>);
      return;
    case 'add':
      await add(state.input as Record<string, unknown>);
      return;
    case 'app':
      await app(state.input as Record<string, unknown>);
      return;
  }
}
