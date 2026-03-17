import type { Actor, SnapshotFrom } from 'xstate';
import type { banditExperimentMachine, ExperimentContext } from './machine';
import type { BanditTrialOutput } from '@xstate-experiments/core';
import config from './config.json';

type ExperimentActor = Actor<typeof banditExperimentMachine>;
type ExperimentSnapshot = SnapshotFrom<typeof banditExperimentMachine>;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STYLES = `
  /* Reset */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: #1a1a2e;
    color: #eee;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
  }

  #app {
    max-width: 800px;
    width: 100%;
    padding: 2rem;
  }

  .screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    text-align: center;
  }

  /* Instructions */
  .instructions h1 {
    font-size: 2rem;
    color: #e94560;
    margin-bottom: 0.5rem;
  }
  .instructions p {
    font-size: 1.1rem;
    line-height: 1.6;
    max-width: 600px;
    white-space: pre-line;
  }
  .btn-start {
    padding: 0.8rem 2.5rem;
    font-size: 1.1rem;
    background: #e94560;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
    margin-top: 1rem;
  }
  .btn-start:hover { background: #c73652; }

  /* Fixation */
  .fixation {
    font-size: 4rem;
    font-weight: 200;
    color: #888;
    line-height: 1;
  }

  /* Stimulus */
  .trial-info {
    font-size: 0.9rem;
    color: #888;
  }
  .arms {
    display: flex;
    gap: 2rem;
    justify-content: center;
  }
  .arm-btn {
    width: 160px;
    height: 160px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: 2px solid #333;
    border-radius: 12px;
    background: #16213e;
    color: #ddd;
    font-size: 1.2rem;
    cursor: pointer;
    transition: border-color 0.15s, transform 0.1s, background 0.15s;
    user-select: none;
  }
  .arm-btn:hover {
    border-color: #e94560;
    transform: scale(1.03);
  }
  .arm-btn .key-hint {
    font-size: 0.75rem;
    color: #666;
    margin-top: 0.25rem;
  }
  .reward-counter {
    font-size: 1.2rem;
    color: #0f3460;
  }
  .reward-counter span {
    color: #e94560;
    font-weight: 700;
  }

  /* Feedback */
  .feedback { gap: 1rem; }
  .feedback-outcome {
    font-size: 3rem;
    font-weight: 700;
  }
  .feedback-outcome.win { color: #27ae60; }
  .feedback-outcome.loss { color: #c0392b; }
  .chosen-label {
    font-size: 1rem;
    color: #888;
  }

  /* Results */
  .results h2 {
    font-size: 1.8rem;
    color: #e94560;
  }
  .results-table {
    border-collapse: collapse;
    margin: 1rem 0;
  }
  .results-table th,
  .results-table td {
    padding: 0.5rem 1.2rem;
    border: 1px solid #333;
    text-align: left;
  }
  .results-table th {
    background: #16213e;
    color: #ccc;
  }
  .results-table td {
    color: #eee;
  }
  .btn-download {
    padding: 0.6rem 1.8rem;
    font-size: 1rem;
    background: #0f3460;
    color: #eee;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-download:hover { background: #1a4a80; }

  .debrief {
    font-size: 0.95rem;
    color: #999;
    max-width: 600px;
    line-height: 1.5;
    margin-top: 0.5rem;
  }
`;

// ---------------------------------------------------------------------------
// State key extraction
// ---------------------------------------------------------------------------

function stateKey(snapshot: ExperimentSnapshot): string {
  const v = snapshot.value;
  if (typeof v === 'string') return v;
  // Nested: { running: 'active' } → 'running.active'
  const outer = Object.keys(v)[0];
  return `${outer}.${(v as any)[outer]}`;
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderInstructions(root: HTMLElement, actor: ExperimentActor): void {
  root.innerHTML = `
    <div class="screen instructions">
      <h1>${config.title}</h1>
      <p>${config.instructions}</p>
      <button class="btn-start" id="btn-start">Begin</button>
    </div>
  `;
  root.querySelector('#btn-start')!.addEventListener('click', () => {
    actor.send({ type: 'START' });
  });
}

function renderFixation(root: HTMLElement, ctx: ExperimentContext): void {
  root.innerHTML = `
    <div class="screen">
      <p class="trial-info">Trial ${ctx.currentIndex + 1} / ${ctx.numTrials}</p>
      <div class="fixation">+</div>
      <p class="reward-counter">Total reward: <span>${ctx.totalReward}</span></p>
    </div>
  `;
}

function renderStimulus(root: HTMLElement, actor: ExperimentActor, ctx: ExperimentContext): void {
  root.innerHTML = `
    <div class="screen">
      <p class="trial-info">Trial ${ctx.currentIndex + 1} / ${ctx.numTrials}</p>
      <div class="arms">
        <button class="arm-btn" data-arm="0">
          Arm 1
          <span class="key-hint">Press 1</span>
        </button>
        <button class="arm-btn" data-arm="1">
          Arm 2
          <span class="key-hint">Press 2</span>
        </button>
      </div>
      <p class="reward-counter">Total reward: <span>${ctx.totalReward}</span></p>
    </div>
  `;

  const sendChoice = (arm: 0 | 1) => {
    // Send to the invoked trial actor
    const trialRef = actor.getSnapshot().children['currentTrial'] as any;
    if (trialRef) {
      trialRef.send({ type: 'CHOOSE', arm });
    }
  };

  root.querySelectorAll('.arm-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const arm = Number((btn as HTMLElement).dataset.arm) as 0 | 1;
      sendChoice(arm);
    });
  });

  // Keyboard handler
  const onKey = (e: KeyboardEvent) => {
    if (e.key === '1') sendChoice(0);
    else if (e.key === '2') sendChoice(1);
  };
  document.addEventListener('keydown', onKey);

  // Clean up on next render (store ref for removal)
  (root as any).__cleanupKeyboard = () => {
    document.removeEventListener('keydown', onKey);
  };
}

function renderFeedback(root: HTMLElement, ctx: ExperimentContext): void {
  const lastResponse = ctx.responses[ctx.responses.length - 1];
  if (!lastResponse) return;

  const isWin = lastResponse.reward === 1;
  const armLabel = `Arm ${lastResponse.chosenArm + 1}`;

  root.innerHTML = `
    <div class="screen feedback">
      <p class="trial-info">Trial ${lastResponse.trialIndex + 1} / ${ctx.numTrials}</p>
      <p class="chosen-label">You chose ${armLabel}</p>
      <div class="feedback-outcome ${isWin ? 'win' : 'loss'}">
        ${isWin ? '+1' : '0'}
      </div>
      <p class="reward-counter">Total reward: <span>${ctx.totalReward}</span></p>
    </div>
  `;
}

function renderResults(root: HTMLElement, ctx: ExperimentContext): void {
  const responses = ctx.responses;
  const optimalArm = ctx.rewardProbabilities[0] >= ctx.rewardProbabilities[1] ? 0 : 1;
  const optimalChoices = responses.filter((r) => r.chosenArm === optimalArm).length;
  const accuracy = ((optimalChoices / responses.length) * 100).toFixed(1);

  root.innerHTML = `
    <div class="screen results">
      <h2>Experiment Complete</h2>
      <table class="results-table">
        <tr><th>Total Reward</th><td>${ctx.totalReward} / ${ctx.numTrials}</td></tr>
        <tr><th>Optimal Choices</th><td>${optimalChoices} / ${responses.length} (${accuracy}%)</td></tr>
        <tr><th>Final Q-values</th><td>Arm 1: ${ctx.qValues[0].toFixed(3)}, Arm 2: ${ctx.qValues[1].toFixed(3)}</td></tr>
      </table>
      <button class="btn-download" id="btn-download">Download Trial Data (CSV)</button>
      <p class="debrief">${config.debrief}</p>
    </div>
  `;

  root.querySelector('#btn-download')!.addEventListener('click', () => {
    downloadCSV(responses);
  });
}

function downloadCSV(responses: BanditTrialOutput[]): void {
  const header = 'trial,chosenArm,reward,rt,qValue0,qValue1,updatedQ0,updatedQ1,rewardProb0,rewardProb1';
  const rows = responses.map((r) =>
    [
      r.trialIndex,
      r.chosenArm,
      r.reward,
      r.rt.toFixed(1),
      r.qValues[0].toFixed(4),
      r.qValues[1].toFixed(4),
      r.updatedQValues[0].toFixed(4),
      r.updatedQValues[1].toFixed(4),
      r.rewardProbabilities[0],
      r.rewardProbabilities[1],
    ].join(','),
  );
  const csv = [header, ...rows].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bandit-2arm-data.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Renderer entry
// ---------------------------------------------------------------------------

/**
 * Connects an XState actor to the DOM. Subscribes to state changes and
 * re-renders only when the state key (e.g. "running.active") changes.
 */
export function createRenderer(actor: ExperimentActor, rootEl: HTMLElement): () => void {
  // Inject styles once
  if (!document.getElementById('bandit-styles')) {
    const style = document.createElement('style');
    style.id = 'bandit-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  let lastKey = '';

  const subscription = actor.subscribe((snapshot) => {
    const key = stateKey(snapshot);
    if (key === lastKey) return;

    // Clean up previous keyboard listener if any
    if ((rootEl as any).__cleanupKeyboard) {
      (rootEl as any).__cleanupKeyboard();
      (rootEl as any).__cleanupKeyboard = null;
    }

    lastKey = key;
    const ctx = snapshot.context;

    switch (key) {
      case 'instructions':
        renderInstructions(rootEl, actor);
        break;
      case 'running.active': {
        // Determine if the trial child is in fixation or stimulus
        // We listen to the trial actor to distinguish fixation vs stimulus vs feedback
        const trialRef = snapshot.children['currentTrial'] as any;
        if (trialRef) {
          renderFixation(rootEl, ctx); // Start with fixation
          const trialSub = trialRef.subscribe((trialSnap: any) => {
            const trialState = trialSnap.value;
            if (trialState === 'stimulus' && lastKey === 'running.active') {
              renderStimulus(rootEl, actor, ctx);
            } else if (trialState === 'feedback' && lastKey === 'running.active') {
              // Feedback is shown with the trial's context
              const trialCtx = trialSnap.context;
              const isWin = trialCtx.reward === 1;
              const armLabel = `Arm ${trialCtx.chosenArm + 1}`;
              rootEl.innerHTML = `
                <div class="screen feedback">
                  <p class="trial-info">Trial ${trialCtx.trialIndex + 1} / ${ctx.numTrials}</p>
                  <p class="chosen-label">You chose ${armLabel}</p>
                  <div class="feedback-outcome ${isWin ? 'win' : 'loss'}">
                    ${isWin ? '+1' : '0'}
                  </div>
                  <p class="reward-counter">Total reward: <span>${ctx.totalReward + trialCtx.reward}</span></p>
                </div>
              `;
            }
          });
          // Store for cleanup
          (rootEl as any).__cleanupTrialSub = () => trialSub.unsubscribe();
        }
        break;
      }
      case 'running.checkNext':
        // Transient state — no render needed, will immediately go to active or results
        break;
      case 'results':
        renderResults(rootEl, ctx);
        break;
    }
  });

  // Return cleanup function
  return () => {
    subscription.unsubscribe();
    if ((rootEl as any).__cleanupKeyboard) {
      (rootEl as any).__cleanupKeyboard();
    }
    if ((rootEl as any).__cleanupTrialSub) {
      (rootEl as any).__cleanupTrialSub();
    }
  };
}
