import { createActor } from 'xstate';
import { reversalExperimentMachine } from './machine';
import { createRenderer } from './renderer';

// Create the experiment actor
const experimentActor = createActor(reversalExperimentMachine);

// Attach the DOM renderer
const cleanup = createRenderer(experimentActor);

// Start the machine
experimentActor.start();

// Log state transitions in dev mode
if (import.meta.env.DEV) {
  experimentActor.subscribe((snapshot) => {
    console.log('[reversal-learning]', snapshot.value, {
      trial: snapshot.context.currentIndex,
      totalReward: snapshot.context.totalReward,
      qValues: snapshot.context.qValues,
    });
  });
}

// Clean up on HMR dispose (Vite)
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanup();
    experimentActor.stop();
  });
}
