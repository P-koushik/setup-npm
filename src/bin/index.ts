#!/usr/bin/env node

import { add } from '../commands/add.js';
import { app } from '../commands/app.js';
import { backend } from '../commands/backend.js';
import { doctor } from '../commands/doctor.js';
import { frontend } from '../commands/frontend.js';
import { init } from '../commands/init.js';

const command = process.argv[2];

switch (command) {
  case undefined:
  case 'init':
    init();
    break;

  case 'add':
    add();
    break;

  case 'app':
    app();
    break;

  case 'backend':
    backend();
    break;

  case 'doctor':
    doctor();
    break;

  case 'frontend':
    frontend();
    break;

  default:
    console.log(`
❌ Unknown command

Usage:
  setup
  setup add
  setup app <firebase-auth|supabase> --frontend|--backend
  setup backend
  setup doctor [node|android|backend]
  setup frontend
  setup init
`);
}
