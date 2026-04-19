export interface BackendConfig {
  projectName: string;
  backendType: 'express' | 'nestjs' | 'fastapi' | 'django' | 'springboot';
  language?: 'TypeScript' | 'JavaScript';
  useMongo?: boolean;
  destinationDir?: string;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
}
