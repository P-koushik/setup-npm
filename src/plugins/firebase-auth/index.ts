import { buildAppIntegration } from '../../engine/appBuilder.js';
import { PluginContext, SetupPlugin } from '../../types/plugin.js';

const firebaseAuthPlugin: SetupPlugin = {
  name: 'firebase-auth',
  validate(context: PluginContext) {
    const target = context.config.target;

    if (target !== 'frontend' && target !== 'backend') {
      return {
        ok: false,
        message: 'Firebase Auth plugin requires a frontend or backend target'
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
          'Firebase Auth frontend integration requires a web or mobile platform'
      };
    }

    return { ok: true };
  },
  async apply(context: PluginContext) {
    await buildAppIntegration({
      provider: 'firebase-auth',
      target: context.config.target as 'frontend' | 'backend',
      frontendPlatform: context.config.frontendPlatform as
        | 'web'
        | 'mobile'
        | undefined
    });
  }
};

export default firebaseAuthPlugin;
