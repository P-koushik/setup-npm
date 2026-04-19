import { addFeature } from '../../engine/addBuilder.js';
import { PluginContext, SetupPlugin } from '../../types/plugin.js';

const cicdPlugin: SetupPlugin = {
  name: 'cicd',
  validate(context: PluginContext) {
    const features = context.config.features;

    if (!Array.isArray(features) || features.length === 0) {
      return {
        ok: false,
        message: 'CI/CD plugin requires a non-empty features list'
      };
    }

    return { ok: true };
  },
  async apply(context: PluginContext) {
    await addFeature({
      features: context.config.features as Array<
        'cicd' | 'slack' | 'discord' | 'linting' | 'formatting' | 'git-hooks'
      >
    });
  }
};

export default cicdPlugin;
