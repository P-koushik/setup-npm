#!/usr/bin/env node

import { add } from '../commands/add.js';
import { app } from '../commands/app.js';
import { backend } from '../commands/backend.js';
import { frontend } from '../commands/frontend.js';

const command = process.argv[2];

switch (command) {
  case 'add':
    add();
    break;

  case 'app':
    app();
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
  setup app <firebase-auth|supabase> --frontend|--backend
  setup backend
  setup frontend
`);
}
