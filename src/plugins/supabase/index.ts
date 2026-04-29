import { buildAppIntegration } from '../../engine/appBuilder.js';
import { PluginContext, SetupPlugin } from '../../types/plugin.js';

const supabasePlugin: SetupPlugin = {
  name: 'supabase',
  async apply(context: PluginContext) {
    await buildAppIntegration({
      provider: 'supabase',
      target: context.config.target as 'frontend' | 'backend',
      frontendPlatform: context.config.frontendPlatform as
        | 'web'
        | 'mobile'
        | undefined
    });
  }
};

export default supabasePlugin;
