import { createActor } from 'xstate';
import { goNoGoExperimentMachine } from './machine';
import { createRenderer } from './renderer';

const app = document.getElementById('app')!;

// Create and start the experiment actor
const experimentActor = createActor(goNoGoExperimentMachine);

// Wire up DOM renderer
createRenderer(app, experimentActor);

// Listen for spacebar presses and forward to the current trial
document.addEventListener('keydown', (e: KeyboardEvent) => {
  // Only forward spacebar; prevent page scroll
  if (e.key === ' ') {
    e.preventDefault();

    // Forward to the trial actor if one is running
    const snapshot = experimentActor.getSnapshot();
    const trialRef = snapshot.children?.currentTrial;
    if (trialRef) {
      (trialRef as any).send({
        type: 'KEYPRESS',
        key: e.key,
        timestamp: performance.now(),
      });
    }
  }
});

experimentActor.start();
