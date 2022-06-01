import { GlobalEvent } from '@alilc/lowcode-types';
import { defineComponent, Fragment, h, onMounted, onUpdated, PropType, ref } from 'vue';
import { RouterView } from 'vue-router';
import { host } from './host';
import { LowCodeRenderer } from './renderer';
import { DocumentInstance, SimulatorRenderer } from './types';

export const Layout = defineComponent({
  props: {
    rendererContainer: {
      type: Object as PropType<SimulatorRenderer>,
      required: true,
    },
  },
  render() {
    const { rendererContainer, $slots } = this;
    const { layout, getComponent } = rendererContainer;
    if (layout) {
      const { Component, props, componentName } = layout;
      if (Component) {
        return h(Component, { key: 'layout', props }, $slots);
      }
      const ComputedComponent = componentName && getComponent(componentName);
      if (ComputedComponent) {
        h(
          ComputedComponent,
          {
            ...props,
            rendererContainer,
            key: 'layout',
          },
          $slots
        );
      }
    }
    const children = $slots.default?.();
    return children ? h(Fragment, null, children) : null;
  },
});

export const SimulatorRendererView = defineComponent({
  props: {
    rendererContainer: {
      type: Object as PropType<SimulatorRenderer>,
      required: true,
    },
  },
  render() {
    return h(
      Layout,
      { rendererContainer: this.rendererContainer },
      { default: () => h(RouterView) }
    );
  },
});

export const Renderer = defineComponent({
  props: {
    documentInstance: {
      type: Object as PropType<DocumentInstance>,
      required: true,
    },
    rendererContainer: {
      type: Object as PropType<SimulatorRenderer>,
      required: true,
    },
  },
  setup() {
    const startTime = ref(Date.now());
    const schemaChangedSymbol = ref(false);

    onMounted(() => recordTime());
    onUpdated(() => recordTime());

    const recordTime = () => {
      if (startTime.value) {
        const time = Date.now() - startTime.value;
        const nodeCount = host.designer.currentDocument?.getNodeCount?.();
        host.designer.editor?.emit(GlobalEvent.Node.Rerender, {
          componentName: 'Renderer',
          type: 'All',
          time,
          nodeCount,
        });
      }
    };

    return { schemaChangedSymbol, startTime };
  },
  render() {
    const { documentInstance } = this;
    const { container, id, deltaData, deltaMode, schema, suspended, scope } =
      documentInstance;
    const { designMode, device, locale, components, appContext, componentsMap } =
      container;
    const messages = container.appContext?.utils?.i18n?.messages || {};
    this.startTime = Date.now();
    this.schemaChangedSymbol = false;

    if (!container.autoRender) return null;

    return h(LowCodeRenderer, {
      locale,
      messages,
      schema,
      deltaData,
      deltaMode,
      components,
      appHelper: appContext,
      designMode,
      device,
      documentId: id,
      suspended,
      document: documentInstance,
      componentsMap,
      self: scope,
      getSchemaChangedSymbol: () => this.schemaChangedSymbol,
      setSchemaChangedSymbol: (val) => void (this.schemaChangedSymbol = val),
      rendererName: 'PageRenderer',
      host,
      container,
      onCompGetCtx: (schema, ref) => documentInstance.mountInstance(schema.id!, ref),
    });
  },
});
