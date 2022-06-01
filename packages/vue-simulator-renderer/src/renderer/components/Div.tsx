import { defineComponent, h } from 'vue';

export const Div = defineComponent({
  name: 'Div',
  version: '0.0.0',
  inheritAttrs: false,
  render() {
    return h('div', this.$attrs);
  },
});
