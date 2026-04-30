export function help() {
  console.log(`
SetupForge scaffolds frontend, backend, and full-stack project foundations.

Usage:
  setupforge [command] [options]

Commands:
  setupforge
    Start the interactive project setup wizard.

  setupforge init
    Start the interactive project setup wizard.

  setupforge frontend
    Scaffold a frontend app such as Next.js, Angular, Vue, Vite, Expo, or React Native.

  setupforge backend
    Scaffold a backend app such as Express, NestJS, FastAPI, Django, or Spring Boot.

  setupforge doctor
    Check whether required local tools are installed before scaffolding or running a detected project.

  setupforge add
    Add project features such as CI/CD, linting, formatting, git hooks, or integrations.

  setupforge app <firebase-auth|supabase> --frontend|--backend
    Add an app integration to an existing frontend or backend project.

  setupforge --help
    Show this help message.

  setupforge -v, --version
    Show the installed SetupForge version.

Common options:
  --name, --project-name <name>       Set the project name.
  --package-manager, --pm <manager>   Choose npm, pnpm, yarn, or bun.
  --frontend, --backend               Select stacks for setup or checks.
  --monorepo, --no-monorepo           Choose monorepo or single-project layout.
  --framework <name>                  Choose a frontend or backend framework.
`);
}
