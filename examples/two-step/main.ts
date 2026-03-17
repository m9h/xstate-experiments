import { createActor } from 'xstate';
import { twoStepExperimentMachine } from './machine';
import { createRenderer } from './renderer';

const app = document.getElementById('app')!;

// Create and start the experiment actor
const experimentActor = createActor(twoStepExperimentMachine);

// Wire up DOM renderer
createRenderer(app, experimentActor);

// Listen for keyboard input and forward to the appropriate actor.
// Keys: 1/ArrowLeft = option 0, 2/ArrowRight = option 1
document.addEventListener('keydown', (e: KeyboardEvent) => {
  let option: 0 | 1 | null = null;

  if (e.key === '1' || e.key === 'ArrowLeft') {
    option = 0;
  } else if (e.key === '2' || e.key === 'ArrowRight') {
    option = 1;
  }

  if (option === null) return;
  e.preventDefault();

  const snapshot = experimentActor.getSnapshot();
  const trialRef = snapshot.children?.currentTrial;
  if (!trialRef) return;

  const trialSnap = (trialRef as any).getSnapshot();
  const trialState = trialSnap.value as string;

  if (trialState === 'stage1') {
    // Stage 1: send choice to the trial actor
    (trialRef as any).send({ type: 'CHOOSE', option });
  } else if (trialState === 'stage2') {
    // Stage 2: send choice to the nested stage2 actor
    const stage2Ref = trialSnap.children?.stage2;
    if (stage2Ref) {
      (stage2Ref as any).send({ type: 'CHOOSE', option });
    }
  }
});

experimentActor.start();
