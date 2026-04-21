# Setupforge

## Introduction

The **Setupforge** is a command-line tool that automates the process of creating and extending modern development projects. It can scaffold **frontend apps**, **backend services**, and **Turborepo-style monorepos**, while also adding integrations, CI/CD workflows, and development tooling safely.

It is built to focus on:

- **reliable project setup**
- **safe modifications**
- **clear error handling**
- **resume support after failures**
- **plugin-based extensibility**

---

## Features

- Initializes a **frontend** with:
  - `Next.js`
  - `Angular`
  - `Vue`
  - `Vite + React`
  - `Expo`
  - `React Native CLI`

- Initializes a **backend** with:
  - `Express`
  - `NestJS`
  - `FastAPI`
  - `Django`
  - `Spring Boot`

- Initializes a **monorepo** with:
  - `apps/web`
  - `apps/api`
  - `packages/types`
  - `packages/models`
  - `packages/eslint-config`
  - `packages/typescript-config`
  - `turbo.json`

- Adds project features safely with:
  - `CI/CD pipeline`
  - `Slack notifications`
  - `Discord notifications`
  - `Linting`
  - `Formatting`
  - `Git hooks`
  - `Firebase Auth`
  - `Supabase`

- Includes built-in reliability features:
  - `setup doctor`
  - `setup resume`
  - `.setuprc` project metadata
  - `.setup/state.json` runtime progress tracking
  - preflight environment validation
  - post-setup validation
  - template validation before copy

---

## Installation

To install the CLI globally from npm:

```sh
npm install -g @koushik.p05/setup
```

If you want to use it locally in this repo:

```sh
npm install
npm run build
```

---

## Usage

To start the guided setup flow:

```sh
setup
```

or:

```sh
setup init
```

To scaffold only a frontend:

```sh
setup frontend
```

To scaffold only a backend:

```sh
setup backend
```

To add features to an existing project:

```sh
setup add
```

To add app integrations directly:

```sh
setup app firebase-auth --web
setup app firebase-auth --mobile
setup app firebase-auth --backend

setup app supabase --web
setup app supabase --mobile
setup app supabase --backend
```

To inspect your environment:

```sh
setup doctor
setup doctor node
setup doctor android
setup doctor backend
```

To continue a failed setup:

```sh
setup resume
```

---

## Folder Structure

### Monorepo Example

```text
my-app/
│── apps/
│   ├── web/
│   ├── api/
│
│── packages/
│   ├── eslint-config/
│   ├── typescript-config/
│   ├── types/
│   ├── models/
│
│── .setup/
│   ├── state.json
│
│── .setuprc
│── package.json
│── turbo.json
│── pnpm-workspace.yaml   # if pnpm is selected
```

### Standard Project Example

```text
my-app/
│── frontend/
│── backend/
│── .setup/
│   ├── state.json
│── .setuprc
```

---

## Steps Executed by the CLI

### 1️⃣ Guided Setup

- Asks for:
  - project name
  - monorepo or standard structure
  - package manager
  - frontend, backend, or both
- Prompts only for missing values when flags are partially provided.
- Writes `.setuprc` and runtime state tracking.

### 2️⃣ Frontend Setup

- Creates the selected frontend app.
- Uses the matching framework generator.
- Installs dependencies when required by that stack.
- Validates generated output after setup.

### 3️⃣ Backend Setup

- Creates the selected backend app.
- Uses:
  - local templates for Express, FastAPI, Django, and Spring Boot
  - official CLI for NestJS
- Installs dependencies or resolves environment setup when required.
- Validates generated output after setup.

### 4️⃣ Monorepo Setup

- Creates a Turborepo-style root.
- Adds workspace apps and shared packages.
- Wires shared package imports like:

```ts
import { User } from '@my-app/types/user';
import { userModel } from '@my-app/models/user-model';
```

- Bootstraps workspace dependencies.
- Configures Turbo dev flow with TUI support.

### 5️⃣ Add Features

- Detects the current project type.
- Validates plugin/template availability.
- Applies only safe file changes.
- Skips or merges existing config instead of duplicating.

---

## Example Workflow

```sh
setup init
```

**Setup Output:**

```sh
? Project name: my-app
? Use monorepo structure? Yes
? Choose package manager: npm
? Choose stacks to setup: Frontend, Backend
? Choose frontend platform: Web
? Choose frontend framework: Next.js
? Choose backend type: Express
? Choose backend language: TypeScript
? Use MongoDB? Yes
```

**CLI Progress Output:**

```sh
▶ Creating workspace root
▶ Scaffolding next project
▶ Installing dependencies
▶ Copying TypeScript Express template files
▶ Bootstrapping monorepo dependencies
✅ Project setup complete
```

---

## Flags Support

The CLI supports non-interactive and partially interactive execution.

### Frontend Examples

```sh
setup frontend --next --name web-app
setup frontend --vue --pnpm --name dashboard
setup frontend --platform native --framework expo --name mobile-app
```

### Backend Examples

```sh
setup backend --framework express --db mongo --ts --name api
setup backend --nestjs --name api
setup backend --framework django --name server
```

If some values are missing, the CLI asks only for those missing inputs.

---

## Add Command

Interactive `setup add` supports:

- CI/CD pipeline
- Slack notifications
- Discord notifications
- Linting
- Formatting
- Git hooks
- Firebase Auth
- Supabase

Direct usage also works:

```sh
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

The add flow is **idempotent**, which means:

- existing generated files are skipped
- known config updates merge safely
- repeated runs avoid duplicate scripts and dependencies

---

## Doctor System

The doctor command checks the environment before important setup steps.

### Node Checks

- Node.js version `>= 18`

### Android Checks

- `ANDROID_HOME` / `ANDROID_SDK_ROOT`
- SDK directory exists
- `adb` available
- `emulator` available

### Backend Checks

- Python availability
- Java availability

Example:

```sh
✔ Node version OK
✖ Android SDK not found

Fix:
- Install Android Studio
- Set ANDROID_HOME
- Add platform-tools to PATH
```

---

## Resume System

If a setup step fails, the CLI stores progress and allows recovery with:

```sh
setup resume
```

This avoids re-running already completed steps.

---

## Plugin System

The CLI includes a plugin-based architecture for feature extensions.

Current built-in plugins:

- `cicd`
- `firebase-auth`
- `supabase`

Each plugin follows this flow:

1. detect project context
2. validate applicability
3. apply safe changes
4. validate output

---

## Development Scripts

```sh
npm run build
npm run lint
npm run format
npm run typecheck
```

---

## License

MIT License

---

## Future Improvements

- External plugin loading
- More backend and frontend stacks
- More monorepo presets
- Docker and deployment templates
- richer project-aware CI generation

---

## Contributing

Feel free to open issues or submit pull requests to improve the CLI.

---

## Links

- **NPM Package:** [https://www.npmjs.com/package/@koushik.p05/setup](https://www.npmjs.com/package/@koushik.p05/setup)
- **GitHub Repository:** [https://github.com/P-koushik/setup-npm](https://github.com/P-koushik/setup-npm)
