import { createActor } from 'xstate';
import { banditExperimentMachine } from './machine';
import { createRenderer } from './renderer';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const rootEl = document.getElementById('app');
if (!rootEl) throw new Error('Missing #app element');

const actor = createActor(banditExperimentMachine);
const cleanup = createRenderer(actor, rootEl);

actor.start();

// Expose for debugging in console
(window as any).__banditActor = actor;

// Clean up on HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanup();
    actor.stop();
  });
}
