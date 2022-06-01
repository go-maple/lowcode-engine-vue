import { init, plugins } from '@alilc/lowcode-engine';
import Inject from '@alilc/lowcode-plugin-inject';
import DataSourcePanePlugin from '@alilc/lowcode-plugin-datasource-pane';
import UndoRedoPlugin from '@alilc/lowcode-plugin-undo-redo';
import SchemaPlugin from '@alilc/lowcode-plugin-schema';
import CodeEditor from '@alilc/lowcode-plugin-code-editor';
import RegistryPlugin from './plugins/registry';
import InitPlugin from './plugins/init';
import SetterPlugin from './plugins/setter';
import './index.scss';

const preference = new Map<string, any>([
  [
    'DataSourcePane',
    {
      importPlugins: [],
      dataSourceTypes: [
        {
          type: 'fetch',
        },
        {
          type: 'jsonp',
        },
      ],
    },
  ],
]);

(async () => {
  await plugins.register(Inject); // 注册全局资源工具，例如样式，脚本，第三方依赖库等
  await plugins.register(RegistryPlugin); // 注册组件库
  await plugins.register(DataSourcePanePlugin); // 注册数据源插件
  await plugins.register(UndoRedoPlugin); // 注册恢复、重做功能
  await plugins.register(SchemaPlugin);
  await plugins.register(CodeEditor);
  await plugins.register(SetterPlugin); // 注册
  await plugins.register(InitPlugin);

  init(
    document.getElementById('lce-container')!,
    // @ts-ignore
    {
      enableCondition: true,
      enableCanvasLock: true,
      supportVariableGlobally: true,
      renderEnv: 'vue',
      simulatorUrl: [
        // 'http://localhost:3333/js/react-simulator-renderer.js',
        // 'http://localhost:3333/css/react-simulator-renderer.css',
        'http://localhost:5558/js/vue-simulator-renderer.js',
        'http://localhost:5558/css/vue-simulator-renderer.css',
        // 'https://alifd.alicdn.com/npm/@alilc/lowcode-react-simulator-renderer@latest/dist/css/react-simulator-renderer.css',
        // 'https://alifd.alicdn.com/npm/@alilc/lowcode-react-simulator-renderer@latest/dist/js/react-simulator-renderer.js',
      ],
    },
    preference
  );
})();
