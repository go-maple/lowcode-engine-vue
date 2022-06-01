import { Component, ComponentPublicInstance } from 'vue';
import { Router } from 'vue-router';
import { ComponentSchema, PageSchema, RequestHandler } from '@alilc/lowcode-types';
import { MinxedComponent } from '@/simulator';
import { BuiltinSimulatorRenderer, DocumentModel, Node } from '@alilc/lowcode-designer';

export type RendererAppHelper = Partial<{
  /** 全局公共函数 */
  utils: Record<string, any>;
  /** 全局常量 */
  constants: Record<string, any>;
  /** react-router 的 history 实例 */
  router: Router;
  /** @deprecated 已无业务使用 */
  match: any;
  /** @experimental 内部使用 */
  logParams: Record<string, any>;
  /** @experimental 内部使用 */
  addons: Record<string, any>;
  /** @experimental 内部使用 */
  requestHandlersMap: Record<
    string,
    RequestHandler<{
      data: unknown;
    }>
  >;
}>;

export type LooseObject = Record<string, any>;

export type RendererAppContext = {
  appHelper: RendererAppHelper;
  components: Record<string, Component>;
  engine: any;
};

export interface SimulatorRenderer extends BuiltinSimulatorRenderer {
  layout: any;
  device: string;
  locale: string;
  appContext: any;
  designMode: string;
  libraryMap: Record<string, string>;
  components: Record<string, Component>;
  autoRender: boolean;
  componentsMap: Record<string, MinxedComponent>;
  documentInstances: DocumentInstance[];
  requestHandlersMap: Record<string, any>;
}

export interface DocumentInstance {
  readonly device: string;
  readonly document: DocumentModel;
  readonly instancesMap: Map<string, any[]>;
  readonly schema: ComponentSchema | PageSchema;
  readonly components: Record<string, Component>;
  readonly componentsMap: Record<string, MinxedComponent>;
  readonly deltaData: any;
  readonly deltaMode: boolean;
  readonly suspended: boolean;
  readonly scope: any;
  readonly path: string;
  readonly id: string;
  readonly context: any;
  readonly designMode: string;
  readonly container: SimulatorRenderer;
  readonly requestHandlersMap: Record<string, any>;
  mountContext(docId: string, id: string, ctx: any): (() => void) | void;
  mountInstance(id: string, instance: ComponentPublicInstance): (() => void) | void;
  unmountIntance(id: string, instance: ComponentPublicInstance): void;
  dispose(): void;
  getNode(id: string): Node | null;
}
