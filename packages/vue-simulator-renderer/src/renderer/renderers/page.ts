import { defineComponent } from 'vue';
import { baseRendererProps, useRenderer } from './base';

export const PageRenderer = defineComponent({
  props: baseRendererProps,
  __renderer__: true,
  setup(props) {
    return useRenderer(props, 'page');
  },
  render() {
    const { components, renderComp, renderContent } = this;
    const Page = components.Page;
    return Page ? renderComp(Page) : renderContent();
  },
});
