import { addFeature } from '../../engine/builders/addBuilder.js';
import { PluginContext, SetupPlugin } from '../../types/plugin.js';

const cicdPlugin: SetupPlugin = {
  name: 'cicd',
  async apply(context: PluginContext) {
    await addFeature({
      features: context.config.features as Array<
        'cicd' | 'slack' | 'discord' | 'linting' | 'formatting' | 'git-hooks'
      >
    });
  }
};

export default cicdPlugin;
