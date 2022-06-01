import { injectAssets } from '@alilc/lowcode-plugin-inject';
import { ILowCodePluginContext } from '@alilc/lowcode-engine';
import assets from '../assets/assets-vue.json';
import schema from '../assets/schema-vue.json';

const editorInit = (ctx: ILowCodePluginContext) => {
  return {
    name: 'editor-init',
    async init() {
      const { material, project } = ctx;
      const loadedAssets = await injectAssets(assets);
      material.setAssets(loadedAssets);
      project.openDocument(schema as any);
    },
  };
};

editorInit.pluginName = 'editorInit';

export default editorInit;
