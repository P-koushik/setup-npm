# setup

CLI tool for scaffolding frontend, backend, monorepo, CI/CD, tooling, and service integrations.

## Requirements

- Node.js 18+

## Install

```bash
npm install
npm run build
```

For local development:

```bash
npm run dev
```

## Commands

### Guided setup

```bash
setup
setup init
```

Starts the guided project flow. It asks for:

- project name
- monorepo or not
- package manager
- frontend, backend, or both

If monorepo is selected, the generator creates a Turborepo-style structure:

```text
apps/
  web/
  api/
packages/
  eslint-config/
  typescript-config/
  types/
  models/
package.json
turbo.json
```

The monorepo root includes:

- Turbo scripts for `dev`, `build`, `lint`, and `typecheck`
- workspace configuration
- shared packages for types and models
- app dependencies on `@<project>/types` and `@<project>/models`
- Turbo `dev` configured to use the TUI

Current monorepo support is intended for JS/TS backends such as Express and NestJS.

### Frontend only

```bash
setup frontend
```

Supported frontend scaffolds:

- Next.js
- Angular
- Vue
- React via Vite
- Expo
- React Native CLI

### Backend only

```bash
setup backend
```

Supported backend scaffolds:

- Express
- NestJS
- FastAPI
- Django
- Spring Boot

Express uses local templates. NestJS uses the official CLI. FastAPI, Django, and Spring Boot use local production-oriented starters.

### Add features

```bash
setup add
```

Interactive add-ons:

- CI/CD pipeline
- Slack notifications
- Discord notifications
- Linting
- Formatting
- Git hooks
- Firebase Auth
- Supabase

Direct usage also works:

```bash
setup add cicd
setup add slack
setup add discord
setup add linting formatting git-hooks
setup add firebase-auth --web
setup add firebase-auth --mobile
setup add firebase-auth --backend
setup add supabase --web
setup add supabase --mobile
setup add supabase --backend
```

If the command already provides enough information, the CLI skips prompts and starts scaffolding immediately.

## CI/CD scaffolding

`setup add cicd` generates project-aware GitHub Actions workflow files in `.github/workflows/`.

Supported detection:

- Node.js projects from `package.json`
- Python projects from `pyproject.toml`, `requirements.txt`, or `manage.py`
- Java projects from `pom.xml`, `build.gradle`, or `build.gradle.kts`

Notification add-ons:

- Slack: requires `SLACK_WEBHOOK_URL`
- Discord: requires `DISCORD_WEBHOOK_URL`

## Tooling scaffolding

`setup add linting formatting git-hooks` can create and update:

- `eslint.config.mjs`
- `.prettierrc`
- `.husky/pre-commit`
- `package.json` scripts
- `package.json` devDependencies
- `package.json` lint-staged config

This currently targets `package.json` projects.

## App integrations

### Firebase Auth

Supported targets:

- frontend web
- frontend mobile
- backend

Examples:

```bash
setup add firebase-auth --web
setup add firebase-auth --mobile
setup add firebase-auth --backend
```

Generated templates are placed under:

```text
integrations/firebase-auth/...
```

### Supabase

Supported targets:

- frontend web
- frontend mobile
- backend

Examples:

```bash
setup add supabase --web
setup add supabase --mobile
setup add supabase --backend
```

Generated templates are placed under:

```text
integrations/supabase/...
```

## Monorepo notes

In generated monorepos:

- frontend app names default to `web`
- backend app names default to `api`
- native frontend app names default to `mobile`
- shared imports are intended to use package names such as `@your-project/types/...`

The root `dev` script uses Turborepo TUI, and shared packages are built before dependent apps start.

## Development scripts

```bash
npm run build
npm run lint
npm run format
npm run typecheck
```
