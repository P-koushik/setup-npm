#!/usr/bin/env node

import { backend } from '../commands/backend.js';
import { frontend } from '../commands/frontend.js';

const command = process.argv[2];

switch (command) {
  case 'backend':
    backend();
    break;

  case 'frontend':
    frontend();
    break;

  default:
    console.log(`
❌ Unknown command

Usage:
  setup backend
  setup frontend
`);
}
