export type PluginContext = {
  projectPath: string;
  projectType: 'frontend' | 'backend' | 'monorepo';
  framework?: string;
  packageManager: 'npm' | 'yarn' | 'pnpm';
  config: Record<string, unknown>;
};

export type PluginValidationResult = {
  ok: boolean;
  message?: string;
};

export type SetupPlugin = {
  name: string;
  detect?: (context: PluginContext) => boolean;
  validate?: (context: PluginContext) => PluginValidationResult;
  apply: (context: PluginContext) => Promise<void>;
};
