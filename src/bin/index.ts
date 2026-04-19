#!/usr/bin/env node

import { add } from '../commands/add.js';
import { backend } from '../commands/backend.js';
import { frontend } from '../commands/frontend.js';

const command = process.argv[2];

switch (command) {
  case 'add':
    add();
    break;

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
  setup add
  setup backend
  setup frontend
`);
}
