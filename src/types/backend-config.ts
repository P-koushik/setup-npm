export interface BackendConfig {
  projectName: string;
  backendType: 'express' | 'nestjs' | 'fastapi';
  language?: 'TypeScript' | 'JavaScript';
  useMongo?: boolean;
}
