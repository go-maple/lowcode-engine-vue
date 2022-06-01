import { parseSchema } from '@/utils/common';
import { isJSSlot, NodeSchema, RootSchema } from '@alilc/lowcode-types';
import { Component, h, onUnmounted, type ExtractPropTypes, type PropType } from 'vue';
import { useRendererContext } from '../context';

export const baseRendererProps = {
  id: {
    type: String,
    required: true,
  },
  schema: {
    type: Object as PropType<RootSchema>,
    default: () => ({}),
  },
  components: {
    type: Object as PropType<Record<string, Component>>,
    required: true,
  },
} as const;

export type BaseRendererProps = ExtractPropTypes<typeof baseRendererProps>;

export const baseRendererPropKeys = Object.keys(
  baseRendererProps
) as (keyof BaseRendererProps)[];

export function useRenderer(props: BaseRendererProps, namespace: string) {
  const { engine, components, triggerCompGetCtx } = useRendererContext();
  const { proxy: __ctx } = engine;

  const disposeFunctions: Array<() => void> = [];

  onUnmounted(() => {
    disposeFunctions.forEach((dispose) => dispose());
  });

  const buildSchema = (schema: NodeSchema, self: any) => {
    const parsedProps = parseSchema(schema.props, self);

    const slotProps: any = {};
    const normalProps: any = {};

    Object.entries(parsedProps).forEach(([key, val]) => {
      if (isJSSlot(val)) {
        slotProps[key] = () => renderChildren(val.value as NodeSchema[]);
      } else if (key === 'className') {
        normalProps.class = val;
      } else {
        normalProps[key] = val;
      }
    });

    if (schema.children) {
      slotProps.default = () => renderChildren(schema.children as NodeSchema[]);
    }

    return { props: normalProps, slots: slotProps };
  };

  const renderContent = () => {
    const {
      props: { class: className, ...restProps },
      slots,
    } = buildSchema(props.schema, __ctx);

    return h('div', { class: [`lce-${namespace}`, className], ...restProps }, slots);
  };

  const renderChildren = (children: NodeSchema | NodeSchema[]) => {
    if (!Array.isArray(children)) {
      children = [children];
    }
    return children.map((item) => {
      const { componentName } = item;
      const Comp = components[componentName];
      if (!Comp) return null;

      const { props, slots } = buildSchema(item, __ctx);
      return h(
        Comp,
        {
          ...props,
          ref: (inst: any) => {
            triggerCompGetCtx(item, inst);
          },
        },
        slots
      );
    });
  };

  const renderComp = (Comp: Component) => {
    const { props: compProps, slots } = buildSchema(props.schema, __ctx);
    return h(Comp, compProps, slots);
  };

  return {
    renderComp,
    renderContent,
  };
}
