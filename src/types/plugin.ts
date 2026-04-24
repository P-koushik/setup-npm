export type PluginContext = {
  projectPath: string;
  projectType: 'frontend' | 'backend' | 'monorepo';
  framework?: string;
  packageManager: 'npm' | 'yarn' | 'pnpm';
  config: Record<string, unknown>;
};

export type SetupPlugin = {
  name: string;
  apply: (context: PluginContext) => Promise<void>;
};
