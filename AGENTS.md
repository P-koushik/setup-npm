# Repository Guidelines

## Project Structure & Module Organization

This repository is a TypeScript CLI for scaffolding projects. Source lives in `src/` and is split by responsibility: `src/bin/` contains the CLI entrypoint, `src/commands/` holds interactive commands, `src/engine/` contains scaffold/build logic, and `src/types/` stores shared interfaces. Generated output is built into `dist/`. Workflow automation lives in `.github/workflows/`. Template assets are expected under `templates/` for generated project files.

## Build, Test, and Development Commands

Use Node.js 18+ locally; CI runs on Node 20.

- `npm run dev -- backend`: run the CLI entrypoint with `tsx` during development.
- `npm run build`: bundle the CLI from `src/bin/index.ts` into `dist/` with `tsup`.
- `npm run lint`: run ESLint on all `.ts` files.
- `npm run format`: apply Prettier formatting across the repo.
- `npm run typecheck`: run `tsc --noEmit` for static type validation.

Run `npm ci` before local verification if dependencies are not installed.

## Coding Style & Naming Conventions

Write TypeScript with ES modules and explicit `.js` import extensions in local imports. Follow Prettier defaults from `.prettierrc`: semicolons enabled, single quotes, and no trailing commas. ESLint uses `typescript-eslint` recommended and strict presets; fix warnings before opening a PR.

Use `camelCase` for variables and functions, `PascalCase` for interfaces/types, and kebab-case for filenames where the repo already uses it, such as `backend-config.ts`.

## Testing Guidelines

There is no implemented automated test suite yet. Until tests are added, treat `npm run lint`, `npm run typecheck`, and `npm run build` as the minimum validation set. When adding tests, keep them close to the feature or in a dedicated `tests/` directory, and mirror the source name, for example `backendBuilder.test.ts`.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits such as `feat: ...` and `fix: ...`; continue using that format. Keep each commit scoped to one change.

For pull requests, include a short description, note any CLI behavior changes, and link the relevant issue when applicable. If prompts or generated output change, include a terminal snippet or screenshot. Confirm lint, typecheck, and build all pass before requesting review.
