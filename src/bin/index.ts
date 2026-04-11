#!/usr/bin/env node

import { backend } from '../commands/backend.js';

const command = process.argv[2];

if (command === 'backend') {
  backend();
} else {
  console.log('Unknown command');
}
