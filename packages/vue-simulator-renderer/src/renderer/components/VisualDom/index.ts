import { defineComponent, h } from 'vue';
import './index.css';

export const VisualDom = defineComponent({
  name: 'VisualDom',
  props: {
    cell: {
      type: Function,
      default: undefined,
    },
    title: {
      type: String,
      default: undefined,
    },
    label: {
      type: String,
      default: undefined,
    },
    text: {
      type: String,
      default: undefined,
    },
    __componentName: {
      type: String,
      default: undefined,
    },
  },
  render() {
    const { cell, title, label, text, __componentName, $slots } = this;
    let mainContent = $slots.default?.();
    if (cell && typeof cell === 'function') {
      mainContent = cell();
    }
    return h('div', { class: 'visual-dom' }, [
      h('div', { class: 'panel-container' }, [
        h('span', { class: 'title' }, title || label || text || __componentName),
        h('div', { class: 'content' }, mainContent),
      ]),
    ]);
  },
});
