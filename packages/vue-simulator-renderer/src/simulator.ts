import {
  BuiltinSimulatorHost,
  BuiltinSimulatorRenderer,
  DocumentModel,
  NodeInstance,
} from '@alilc/lowcode-designer';
import { ComponentSchema, NpmInfo, TransformStage } from '@alilc/lowcode-types';
import {
  AssetLoader,
  cursor,
  getProjectUtils,
  getSubComponent,
  isElement,
  setNativeSelection,
} from '@alilc/lowcode-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import {
  App,
  createApp,
  ref,
  Ref,
  Component,
  shallowRef,
  reactive,
  computed,
  triggerRef,
  ComponentPublicInstance,
} from 'vue';
import { getClientRects } from './utils/get-client-rects';
import './simulator.less';
import { buildComponents } from './utils/vue';
import { withQueryParams } from './utils/url';
import { DocumentInstance, SimulatorRenderer } from './types';
import { Renderer, SimulatorRendererView } from './simulator-view';

const loader = new AssetLoader();

const SYMBOL_VDID = Symbol('_LCDocId');
const SYMBOL_VNID = Symbol('_LCNodeId');
const SYMBOL_VInstance = Symbol('_LCInstance');

export interface ComponentHTMLElement extends HTMLElement {
  [SYMBOL_VDID]: string;
  [SYMBOL_VNID]: string;
  [SYMBOL_VInstance]: ComponentPublicInstance;
}

export function isComponentHTMLElement(el: Element): el is ComponentHTMLElement {
  return SYMBOL_VDID in el;
}

export type MinxedComponent = NpmInfo | Component | ComponentSchema;

export function createDocumentInstance(
  container: SimulatorRenderer,
  document: DocumentModel,
  host: BuiltinSimulatorHost
): DocumentInstance {
  const device: Ref<string> = ref('default');
  const deltaMode: Ref<boolean> = ref(false);
  const designMode: Ref<string> = ref('design');
  const deltaData: Ref<Record<string, any>> = ref({});
  const components: Ref<Record<string, Component>> = ref({});
  const componentsMap: Ref<Record<string, MinxedComponent>> = ref({});
  const appContext: Ref<any> = ref({});
  const scope: Ref<any> = ref(null);
  const suspended: Ref<boolean> = ref(false);
  const instancesMap = new Map<string, any[]>();
  const requestHandlersMap: Ref<any> = ref(null);

  const disposeFunctions: Array<() => void> = [];

  const mountContext: DocumentInstance['mountContext'] = (docId, id, ctx) => {
    console.log(docId, id, ctx);
  };

  const checkInstanceMounted = (instance: any): boolean => {
    if (isElement(instance)) {
      return instance.parentElement != null;
    } else if ('isMounted' in instance) {
      return instance.isMounted;
    }
    return true;
  };

  const mountInstance: DocumentInstance['mountInstance'] = (id, instance) => {
    const docId = document.id;
    if (instance == null) {
      let instances = instancesMap.get(id);
      if (instances) {
        instances = instances.filter(checkInstanceMounted);
        if (instances.length > 0) {
          instancesMap.set(id, instances);
          host.setInstance(document.id, id, instances);
        } else {
          instancesMap.delete(id);
          host.setInstance(document.id, id, null);
        }
      }
      return;
    }

    const el = (instance as any).vnode.el;

    const origId = el[SYMBOL_VNID];
    if (origId && origId !== id) {
      // 另外一个节点的 instance 在此被复用了，需要从原来地方卸载
      unmountIntance(origId, instance);
    }

    const unmount = () => unmountIntance(id, instance);

    (el as any)[SYMBOL_VNID] = id;
    (el as any)[SYMBOL_VDID] = docId;
    (el as any)[SYMBOL_VInstance] = instance;
    let instances = instancesMap.get(id);
    if (instances) {
      const l = instances.length;
      instances = instances.filter(checkInstanceMounted);
      let updated = instances.length !== l;
      if (!instances.includes(instance)) {
        instances.push(instance);
        updated = true;
      }
      if (!updated) return unmount;
    } else {
      instances = [instance];
    }
    instancesMap.set(id, instances);
    host.setInstance(document.id, id, instances);
    return unmount;
  };

  const unmountIntance: DocumentInstance['unmountIntance'] = (id, instance) => {
    const instances = instancesMap.get(id);
    if (instances) {
      const i = instances.indexOf(instance);
      if (i > -1) {
        instances.splice(i, 1);
        host.setInstance(document.id, id, instances);
      }
    }
  };

  const getNode: DocumentInstance['getNode'] = (id) => {
    return document.getNode(id);
  };

  return reactive({
    device: computed(() => device.value),
    document: computed(() => document),
    instancesMap: instancesMap,
    schema: computed(() => document.export(TransformStage.Render)),
    components: computed(() => components.value),
    componentsMap: computed(() => componentsMap.value),
    deltaData: computed(() => deltaData.value),
    deltaMode: computed(() => deltaMode.value),
    suspended: computed(() => suspended.value),
    scope: computed(() => scope.value),
    path: computed(() => {
      const { fileName } = document;
      return fileName.startsWith('/') ? fileName : `/${fileName}`;
    }),
    id: computed(() => document.id),
    context: computed(() => appContext.value),
    designMode: computed(() => designMode.value),
    container: computed(() => container),
    requestHandlersMap: computed(() => requestHandlersMap.value),
    mountContext,
    mountInstance,
    unmountIntance,
    dispose: () => void disposeFunctions.forEach((dispose) => dispose()),
    getNode,
  }) as DocumentInstance;
}

export function createSimulatorRenderer(host: BuiltinSimulatorHost) {
  const autoRender = ref(host.autoRender);
  const layout: Ref<any> = ref();
  const device: Ref<string> = ref('default');
  const locale: Ref<string | undefined> = ref();
  const appContext: Ref<any> = shallowRef({});
  const designMode: Ref<string> = ref('design');
  const libraryMap: Ref<Record<string, string>> = ref({});
  const components: Ref<Record<string, Component>> = ref({});
  const componentsMap: Ref<Record<string, MinxedComponent>> = ref({});
  const requestHandlersMap: Ref<any> = ref(null);
  const documentInstances: Ref<DocumentInstance[]> = ref([]);
  const disposeFunctions: Array<() => void> = [];

  const documentInstanceMap = new Map<string, DocumentInstance>();

  let app: App | null = null;
  let running = false;

  const getClosestNodeInstance = (
    el: Element,
    specId?: string
  ): NodeInstance<ComponentPublicInstance> | null => {
    while (el) {
      if (isComponentHTMLElement(el)) {
        const nodeId = el[SYMBOL_VNID];
        const docId = el[SYMBOL_VDID];
        if (!specId || specId === nodeId) {
          return {
            docId,
            nodeId,
            instance: el[SYMBOL_VInstance],
          };
        }
      }
      el = el.parentElement as Element;
    }

    return null;
  };

  const simulator: BuiltinSimulatorRenderer = {
    isSimulatorRenderer: true,
    getComponent(componentName) {
      const paths = componentName.split('.');
      const subs: string[] = [];

      while (paths.length > 0) {
        const component = components.value[componentName];
        if (component) {
          return getSubComponent(component, subs);
        }

        const sub = paths.pop();
        if (!sub) break;
        subs.unshift(sub);
        componentName = paths.join('.');
      }
      return null!;
    },
    getClosestNodeInstance(from: Element, nodeId) {
      console.log(getClosestNodeInstance(from, nodeId));
      return getClosestNodeInstance(from, nodeId);
    },
    findDOMNodes(instance) {
      console.log('findDOMNodes', instance);
      return null;
    },
    getClientRects(element) {
      console.log('getClientRects', element);
      return getClientRects(element);
    },
    setNativeSelection(enableFlag) {
      console.log('setNativeSelection', enableFlag);
      setNativeSelection(enableFlag);
    },
    setDraggingState(state: boolean) {
      cursor.setDragging(state);
    },
    setCopyState(state: boolean) {
      cursor.setCopy(state);
    },
    clearState() {
      cursor.release();
    },
    createComponent(schema) {
      console.log('createComponent', schema);
      return null;
    },
    run() {
      if (running) return;

      running = true;
      const containerId = 'app';
      let container = document.getElementById(containerId);

      if (!container) {
        container = document.createElement('div');
        document.body.appendChild(container);
        container.id = containerId;
      }

      document.documentElement.classList.add('engine-page');
      document.body.classList.add('engine-document'); // important! Stylesheet.invoke depends

      app = createApp(SimulatorRendererView, { rendererContainer: renderer });
      app.use(router);
      app.mount(container);
      host.project.setRendererReady(this);
    },
  };

  const renderer = reactive({
    layout,
    device,
    appContext,
    designMode,
    libraryMap,
    components,
    autoRender,
    componentsMap,
    documentInstances,
    requestHandlersMap,
    ...simulator,
  }) as SimulatorRenderer;

  const router = createRouter({
    history: createMemoryHistory('/'),
    routes: [],
  });

  disposeFunctions.push(
    host.connect(simulator, () => {
      // sync layout config
      layout.value = host.project.get('config').layout;

      // todo: split with others, not all should recompute
      if (
        libraryMap.value !== host.libraryMap ||
        componentsMap.value !== host.designer.componentsMap
      ) {
        libraryMap.value = host.libraryMap || {};
        componentsMap.value = host.designer.componentsMap as any;
        components.value = buildComponents(
          libraryMap.value,
          componentsMap.value,
          simulator.createComponent
        );
      }

      locale.value = host.locale;

      // sync device
      device.value = host.device;

      // sync designMode
      designMode.value = host.designMode;

      // sync requestHandlersMap
      requestHandlersMap.value = host.requestHandlersMap;
    })
  );

  disposeFunctions.push(
    host.autorun(() => {
      documentInstances.value = host.project.documents.map((doc) => {
        let inst = documentInstanceMap.get(doc.id);
        if (!inst) {
          inst = createDocumentInstance(renderer, doc, host);
          documentInstanceMap.set(doc.id, inst);
        }
        if (!router.hasRoute(doc.id)) {
          router.addRoute({
            name: doc.id,
            path: inst.path,
            props: { documentInstance: inst, rendererContainer: renderer },
            component: Renderer,
          });
        }
        return inst;
      });
      router.getRoutes().forEach((route) => {
        const hasDoc = documentInstances.value.some((doc) => doc.id === route.name);
        if (!hasDoc) {
          router.removeRoute(route.name!);
        }
      });

      const path = host.project.currentDocument
        ? documentInstanceMap.get(host.project.currentDocument.id)!.path
        : '/';

      if (router.currentRoute.value.path !== path) {
        router.replace(path);
      }
    })
  );

  router.afterEach((to) => {
    const docId = to.path.slice(1);
    docId && host.project.open(docId);
  });

  host.componentsConsumer.consume(async (componentsAsset) => {
    if (componentsAsset) {
      await loader.load(componentsAsset);
      components.value = buildComponents(
        libraryMap.value,
        componentsMap.value,
        simulator.createComponent
      );
    }
  });

  appContext.value = {
    utils: {
      router: {
        push(path: string, params?: object) {
          router.push(withQueryParams(path, params));
        },
        replace(path: string, params?: object) {
          router.replace(withQueryParams(path, params));
        },
      },
      i18n: {
        setLocale: (loc: string) => {
          locale.value = loc;
          appContext.value.utils.i18n.currentLocale = loc;
        },
        get currentLocale() {
          return locale.value;
        },
        messages: {},
      },
      ...getProjectUtils(libraryMap.value, host.get('utilsMetadata')),
    },
    constants: {},
    get requestHandlersMap() {
      return requestHandlersMap.value;
    },
  };

  host.injectionConsumer.consume((data) => {
    // TODO: sync utils, i18n, contants,... config
    appContext.value.utils.i18n.messages = data.i18n || {};
    triggerRef(appContext);
  });

  return {
    ...simulator,
    dispose: () => {
      disposeFunctions.forEach((fn) => fn());
      app?.unmount();
    },
  };
}
