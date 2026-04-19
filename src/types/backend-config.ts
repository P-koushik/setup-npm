export interface BackendConfig {
  projectName: string;
  backendType: 'express' | 'nestjs' | 'fastapi' | 'django' | 'springboot';
  language?: 'TypeScript' | 'JavaScript';
  useMongo?: boolean;
}
