# Setupforge

## Introduction

The **Setupforge** is a command-line tool that automates the process of creating and extending modern development projects. It can scaffold **frontend apps**, **backend services**, and **Turborepo-style monorepos**, while also adding integrations, CI/CD workflows, and development tooling safely.

It is built to focus on:

- **reliable project setup**
- **safe modifications**
- **clear error handling**
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

---

## Installation

To install the CLI globally from npm:

```sh
npm install -g setupforge
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
setupforge
```

When you run bare `setupforge`, the CLI first checks npm for a newer
SetupForge version. If one is available, you can choose to update immediately
with the global install command or continue without updating.

or:

```sh
setupforge init
```

To scaffold only a frontend:

```sh
setupforge frontend
```

To scaffold only a backend:

```sh
setupforge backend
```

To add features to an existing project:

```sh
setupforge add
```

To add app integrations directly:

```sh
setupforge app firebase-auth --web
setupforge app firebase-auth --mobile
setupforge app firebase-auth --backend

setupforge app supabase --web
setupforge app supabase --mobile
setupforge app supabase --backend
```

To show command help:

```sh
setupforge --help
setupforge help
```

To show the installed version:

```sh
setupforge -v
setupforge --version
setupforge -version
setupforge version
```

### Command Reference

| Command                                    | Description                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `setupforge`                               | Check for updates, then start the guided setup flow.                   |
| `setupforge init`                          | Start the guided setup flow without the startup update prompt.         |
| `setupforge frontend`                      | Scaffold a frontend app.                                               |
| `setupforge backend`                       | Scaffold a backend app.                                                |
| `setupforge doctor`                        | Check local tool requirements for selected or detected project stacks. |
| `setupforge add`                           | Add CI/CD, linting, formatting, hooks, notifications, or integrations. |
| `setupforge app <firebase-auth\|supabase>` | Add a specific app integration to a frontend or backend.               |
| `setupforge --help`                        | Show command help.                                                     |
| `setupforge -v`                            | Show the installed SetupForge version.                                 |

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
│── package.json
│── turbo.json
│── pnpm-workspace.yaml   # if pnpm is selected
```

### Standard Project Example

```text
my-app/
│── frontend/
│── backend/
```

---

## Steps Executed by the CLI

### 0️⃣ Startup Update Check

When running bare `setupforge`, the CLI checks the latest npm version of
`setupforge`.

If a newer version exists, it asks whether to:

- **Update now**: runs `npm install -g setupforge@latest`, then exits so you can
  rerun the updated CLI.
- **Continue without updating**: skips the update and starts the normal guided
  setup flow.

The update check is skipped for subcommands such as `setupforge init`,
`setupforge --help`, `setupforge -v`, `setupforge doctor`, and direct scaffold
commands.

For CI or development, you can disable the update check:

```sh
SETUPFORGE_SKIP_UPDATE_CHECK=1 setupforge
```

### 1️⃣ Guided Setup

- Asks for:
  - project name
  - monorepo or standard structure
  - package manager
  - frontend, backend, or both
- Prompts only for missing values when flags are partially provided.

### 2️⃣ Frontend Setup

- Creates the selected frontend app.
- Uses the matching framework generator.
- Installs dependencies when required by that stack.

### 3️⃣ Backend Setup

- Creates the selected backend app.
- Uses:
  - local templates for Express, FastAPI, Django, and Spring Boot
  - official CLI for NestJS
- Installs dependencies or resolves environment setup when required.

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
- Applies only safe file changes.
- Skips or merges existing config instead of duplicating.

---

## Example Workflow

```sh
setupforge init
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
setupforge frontend --next --name web-app
setupforge frontend --vue --pnpm --name dashboard
setupforge frontend --platform native --framework expo --name mobile-app
```

### Backend Examples

```sh
setupforge backend --framework express --db mongo --ts --name api
setupforge backend --nestjs --name api
setupforge backend --framework django --name server
```

If some values are missing, the CLI asks only for those missing inputs.

---

## Add Command

Interactive `setupforge add` supports:

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
setupforge add cicd
setupforge add slack
setupforge add discord
setupforge add linting formatting git-hooks
setupforge add firebase-auth --web
setupforge add firebase-auth --mobile
setupforge add firebase-auth --backend
setupforge add supabase --web
setupforge add supabase --mobile
setupforge add supabase --backend
```

The add flow is **idempotent**, which means:

- existing generated files are skipped
- known config updates merge safely
- repeated runs avoid duplicate scripts and dependencies

---

## Plugin System

The CLI includes a plugin-based architecture for feature extensions.

Current built-in plugins:

- `cicd`
- `firebase-auth`
- `supabase`

Each plugin receives project context and applies its changes directly.

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

- **NPM Package:** [https://www.npmjs.com/package/setupforge](https://www.npmjs.com/package/setupforge)
- **GitHub Repository:** [https://github.com/P-koushik/setup-npm](https://github.com/P-koushik/setup-npm)
