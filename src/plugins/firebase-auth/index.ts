import { buildAppIntegration } from '../../engine/builders/appBuilder.js';
import { PluginContext, SetupPlugin } from '../../types/plugin.js';

const firebaseAuthPlugin: SetupPlugin = {
  name: 'firebase-auth',
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
