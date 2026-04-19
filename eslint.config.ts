import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';

export default defineConfig([
  // ✅ Ignore build + deps
  {
    ignores: ['dist', 'node_modules']
  },

  // ✅ Base JS rules
  js.configs.recommended,

  // ✅ TypeScript rules
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,

  // ✅ Environment (Node CLI)
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      globals: globals.node
    }
  },

  // ✅ Disable ESLint rules that conflict with Prettier
  prettier
]);
