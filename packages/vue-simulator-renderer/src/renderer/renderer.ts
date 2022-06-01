import {
  Component,
  PropType,
  defineComponent,
  h,
  ref,
  Ref,
  provide,
  getCurrentInstance,
  reactive,
  computed,
  toRef,
  onUnmounted,
  toRaw,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  onUpdated,
  watchEffect,
  ExtractPropTypes,
} from 'vue';
import { NodeSchema, RootSchema } from '@alilc/lowcode-types';
import Debug from 'debug';
import {
  DocumentInstance,
  LooseObject,
  RendererAppContext,
  RendererAppHelper,
  SimulatorRenderer,
} from '../types';
import { Div } from './components/Div';
import contextFactory from './context';
import { BuiltinSimulatorHost } from '@alilc/lowcode-designer';
import { RENDERER_COMPS } from './renderers';
import { getI18n, parseSchema } from '@/utils/common';

const noop = () => void 0;

const debug = Debug('renderer:entry');

export const rendererProps = {
  schema: {
    type: Object as PropType<NodeSchema>,
    required: true,
  },
  components: {
    type: Object as PropType<Record<string, Component>>,
    required: true,
  },

  self: Object,
  deltaData: Object,
  documentId: String,
  deltaMode: Boolean,

  /** 语言 */
  locale: String,
  messages: Object as PropType<Record<string, any>>,
  /** 主要用于设置渲染模块的全局上下文，里面定义的内容可以在低代码中通过 this 来访问，比如 this.utils */
  appHelper: Object as PropType<RendererAppHelper>,
  /**
   * 配置规范参见《中后台搭建组件描述协议》，主要在搭建场景中使用，用于提升用户搭建体验。
   *
   * > 在生产环境下不需要设置
   */
  componentsMap: Object as PropType<Record<string, any>>,
  /** 设计模式，可选值：live、design */
  designMode: String,
  /** 渲染模块是否挂起，当设置为 true 时，渲染模块最外层容器的 shouldComponentUpdate 将始终返回false，在下钻编辑或者多引擎渲染的场景会用到该参数。 */
  suspended: Boolean,
  /** 组件获取 ref 时触发的钩子 */
  onCompGetRef: {
    type: Function as PropType<(schema: NodeSchema, ref: any) => void>,
    default: noop,
  },
  /** 组件 ctx 更新回调 */
  onCompGetCtx: {
    type: Function as PropType<(schema: NodeSchema, ref: any) => void>,
    default: noop,
  },
  /** 传入的 schema 是否有变更 */
  getSchemaChangedSymbol: Function as PropType<() => boolean>,
  /** 设置 schema 是否有变更 */
  setSchemaChangedSymbol: Function as PropType<(symbol: boolean) => void>,
  /** 自定义创建 element 的钩子 */
  customCreateElement: Function as PropType<
    (Component: any, props: any, children: any) => any
  >,
  /** 渲染类型，标识当前模块是以什么类型进行渲染的 */
  rendererName: String as PropType<'LowCodeRenderer' | 'PageRenderer' | string>,
  /** 当找不到组件时，显示的组件 */
  notFoundComponent: [Object, Function] as PropType<Component>,
  /** 当组件渲染异常时，显示的组件 */
  faultComponent: [Object, Function] as PropType<Component>,
  /** 设备信息 */
  device: String,
  host: Object as PropType<BuiltinSimulatorHost>,
  document: Object as PropType<DocumentInstance>,
  container: Object as PropType<SimulatorRenderer>,
};

export type RendererProps = ExtractPropTypes<typeof rendererProps>;

const NotFoundComponent = defineComponent({
  render() {
    return h(Div, this.$attrs, {
      default: () => 'Component Not Found',
      ...this.$slots,
    });
  },
});

const FaultComponent = defineComponent({
  render() {
    console.error('render error', this.$props);
    return h(
      Div,
      {
        style: {
          width: '100%',
          height: '50px',
          lineHeight: '50px',
          textAlign: 'center',
          fontSize: '15px',
          color: '#ff0000',
          border: '2px solid #ff0000',
        },
      },
      { default: () => '组件渲染异常，请查看控制台日志' }
    );
  },
});

const LIFT_CYCLES_MAP = {
  beforeMount: onBeforeMount,
  mounted: onMounted,
  beforeUpdate: onBeforeUpdate,
  updated: onUpdated,
  beforeUnmount: onBeforeUnmount,
  unmounted: onUnmounted,
};

function useRootSchema(schema: Ref<RootSchema>) {
  const instance = getCurrentInstance();
  const {
    state: stateSchema,
    methods: methodsSchema,
    lifeCycles: lifeCyclesSchema,
  } = schema.value;

  // 处理 state
  const stateFactories = parseSchema(stateSchema, undefined);
  const state = Object.keys(stateFactories ?? {}).reduce((refs, key) => {
    refs[key] = ref(stateFactories[key]);
    return refs;
  }, {} as Record<string, Ref<any>>);

  // 处理 methods
  const methods = parseSchema(methodsSchema, instance?.proxy);

  // 处理 lifecycle
  const lifeCycles = parseSchema(lifeCyclesSchema, instance?.proxy);
  Object.entries(lifeCycles ?? {}).forEach(([lifeCycle, callback]: [any, any]) => {
    const hook = LIFT_CYCLES_MAP[lifeCycle as keyof typeof LIFT_CYCLES_MAP];
    hook?.(callback);
  });

  // 处理 css
  let styleElement: HTMLStyleElement | null = null;
  watchEffect(() => {
    const css = schema.value.css ?? '';
    if (css) {
      if (!styleElement) {
        const style = document.createElement('style');
        style.setAttribute('from', 'style-sheet');
        if (style.firstChild) {
          style.removeChild(style.firstChild);
        }
        const head = document.head || document.getElementsByTagName('head')[0];
        head.appendChild(style);
        styleElement = style;
      }
      if (styleElement.innerHTML === css) {
        return;
      }

      styleElement.innerHTML = css;
    }
  });
  return { state, methods };
}

export function useI18n(props: RendererProps) {
  const $t = (key: string, values: LooseObject = {}) => {
    const { locale, messages } = props;
    return getI18n(key, values, locale, messages);
  };

  const setLocale = (loc: string) => {
    props.appHelper?.utils?.i18n.setLocale?.(loc);
  };

  const getLocale = () => props.locale;

  return { $t, setLocale, getLocale };
}

export const Renderer = defineComponent({
  props: rendererProps,
  setup(props) {
    debug(`entry.setup - ${props?.schema?.componentName}`);

    const contextKey = contextFactory();
    const instance = getCurrentInstance();

    const disposeFunctions: (() => void)[] = [];

    const inst = ref();
    const error: Ref<Error | null> = ref(null);
    const engineRenderError: Ref<boolean> = ref(false);

    const Fault = computed(() => props.faultComponent ?? FaultComponent);
    const NotFound = computed(() => props.notFoundComponent ?? NotFoundComponent);

    const getRef = (val: any) => {
      inst.value = val;
      if (val) {
        const unmount = triggerCompGetCtx(props.schema!, val);
        unmount && disposeFunctions.push(unmount);
      }
    };

    const triggerCompGetCtx = (schema: NodeSchema, val: any) => {
      if (val) {
        const instance = val._ ? toRaw(val._) : val;
        return props.onCompGetCtx?.(schema, instance);
      }
      return null;
    };

    onUnmounted(() => {
      disposeFunctions.forEach((dispose) => dispose());
    });

    provide(
      contextKey,
      reactive({
        engine: instance,
        triggerCompGetCtx,
        appHelper: toRef(props, 'appHelper'),
        components: computed(() => ({ ...RENDERER_COMPS, ...props.components })),
      }) as RendererAppContext
    );

    const { state, methods } = useRootSchema(toRef(props, 'schema') as Ref<RootSchema>);

    return {
      error,
      engineRenderError,
      Fault,
      NotFound,
      inst,
      getRef,
      triggerCompGetCtx,
      ...state,
      ...methods,
      ...useI18n(props),
    };
  },
  render() {
    const { schema, components, getRef } = this;
    if (!schema) {
      return null;
    }
    debug('entry.render');
    const { componentName } = schema!;
    const allComponents = { ...RENDERER_COMPS, ...components };
    let Comp = allComponents[componentName] || RENDERER_COMPS[`${componentName}Renderer`];
    if (Comp && !(Comp as any).__renderer__) {
      Comp = RENDERER_COMPS[`${componentName}Renderer`];
    }
    if (Comp) {
      return h(Comp, {
        key: schema.__ctx && `${schema.__ctx.lceKey}_${schema.__ctx.idx || '0'}`,
        ref: getRef,
        components: allComponents,
        schema,
        id: schema.id,
      } as any);
    }
    return null;
  },
});
