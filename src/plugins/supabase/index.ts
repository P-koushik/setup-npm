import { buildAppIntegration } from '../../engine/appBuilder.js';
import { PluginContext, SetupPlugin } from '../../types/plugin.js';

const supabasePlugin: SetupPlugin = {
  name: 'supabase',
  validate(context: PluginContext) {
    const target = context.config.target;

    if (target !== 'frontend' && target !== 'backend') {
      return {
        ok: false,
        message: 'Supabase plugin requires a frontend or backend target'
      };
    }

    if (
      target === 'frontend' &&
      context.config.frontendPlatform !== 'web' &&
      context.config.frontendPlatform !== 'mobile'
    ) {
      return {
        ok: false,
        message:
          'Supabase frontend integration requires a web or mobile platform'
      };
    }

    return { ok: true };
  },
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
