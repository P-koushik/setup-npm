#!/usr/bin/env node

import { add } from '../commands/add.js';
import { app } from '../commands/app.js';
import { backend } from '../commands/backend.js';
import { doctor } from '../commands/doctor.js';
import { frontend } from '../commands/frontend.js';
import { help } from '../commands/help.js';
import { init } from '../commands/init.js';
import {
  checkForUpdates,
  getInstalledPackageInfo
} from '../utils/update-check.js';

const command = process.argv[2];

async function main() {
  if (command !== '--help' && command !== '-h' && command !== 'help') {
    await checkForUpdates();
  }

  switch (command) {
    case '--help':
    case '-h':
    case 'help':
      help();
      break;

    case '-v':
    case '--version':
    case '-version':
    case 'version':
      console.log(getInstalledPackageInfo().version);
      break;

    case undefined:
    case 'init':
      await init();
      break;

    case 'add':
      await add();
      break;

    case 'app':
      await app();
      break;

    case 'backend':
      await backend();
      break;

    case 'doctor':
      await doctor();
      break;

    case 'frontend':
      await frontend();
      break;

    default:
      console.log(`❌ Unknown command\n`);
      help();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`❌ ${error.message}`);
  } else {
    console.error('❌ Something went wrong:', error);
  }

  process.exit(1);
});
