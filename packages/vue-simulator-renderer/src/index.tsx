import { host } from './host';
import { createSimulatorRenderer } from './simulator';

const renderer = createSimulatorRenderer(host);

if (typeof window !== 'undefined') {
  (window as any).SimulatorRenderer = renderer;
}

window.addEventListener('beforeunload', () => {
  (window as any).LCSimulatorHost = null;
  renderer.dispose?.();
  (window as any).SimulatorRenderer = null;
});

export default renderer;
