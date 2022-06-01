import { RendererAppHelper } from '@/types';
import { NodeSchema } from '@alilc/lowcode-types';
import { Component, inject, InjectionKey } from 'vue';

export type RendererAppContext = {
  engine: any;
  appHelper: RendererAppHelper;
  triggerCompGetCtx(schema: NodeSchema, val: any): (() => void) | null;
  components: Record<string, Component>;
  blockContext: any;
};

export default function contextFactory(): InjectionKey<RendererAppContext> {
  let context = (window as any).__appContext;
  if (!context) {
    context = Symbol('__appContext');
    (window as any).__appContext = context;
  }
  return context;
}

export function useRendererContext() {
  const key = contextFactory();
  return inject(key)!;
}
