import type { AnyActor } from 'xstate';
import type { ReversalExperimentContext, ReversalTrialOutput } from './machine';
import config from './config.json';

// ─── Styles ──────────────────────────────────────────────────────────────────

const STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #1a1a2e;
    color: #e0e0e0;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    overflow: hidden;
  }
  #app {
    text-align: center;
    max-width: 720px;
    width: 100%;
    padding: 2rem;
  }
  h1 {
    color: #e94560;
    font-size: 1.8rem;
    margin-bottom: 1rem;
  }
  h2 {
    color: #e94560;
    font-size: 1.4rem;
    margin-bottom: 1rem;
  }
  .instructions {
    white-space: pre-line;
    line-height: 1.7;
    font-size: 1.05rem;
    margin-bottom: 2rem;
    color: #c0c0c0;
  }
  button.primary {
    background: #e94560;
    color: #fff;
    border: none;
    padding: 0.75rem 2.5rem;
    font-size: 1.1rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }
  button.primary:hover { background: #d63851; }
  button.primary:active { background: #c02a43; }

  .fixation {
    font-size: 4rem;
    font-weight: bold;
    color: #e94560;
    line-height: 200px;
  }

  .status-bar {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
    color: #888;
  }
  .phase-indicator {
    color: #e94560;
    font-weight: 600;
  }

  .arms {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    margin-top: 2rem;
  }
  .arm-box {
    width: 140px;
    height: 140px;
    border: 3px solid #333;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.15s, transform 0.15s, background 0.15s;
    background: #16213e;
    user-select: none;
  }
  .arm-box:hover {
    border-color: #e94560;
    transform: scale(1.05);
  }
  .arm-box .label {
    font-size: 2.5rem;
    font-weight: bold;
    color: #e0e0e0;
  }
  .arm-box .hint {
    font-size: 0.8rem;
    color: #666;
    margin-top: 0.3rem;
  }

  .arm-box.chosen {
    border-color: #e94560;
    background: #1a1a3e;
  }
  .arm-box.chosen.reward {
    border-color: #4ecca3;
    background: #1a3e2e;
  }
  .arm-box.chosen.no-reward {
    border-color: #e94560;
    background: #3e1a1a;
  }

  .feedback-text {
    font-size: 2rem;
    font-weight: bold;
    margin-top: 1.5rem;
  }
  .feedback-text.reward { color: #4ecca3; }
  .feedback-text.no-reward { color: #e94560; }

  .total-display {
    font-size: 1.1rem;
    color: #888;
    margin-top: 0.75rem;
  }

  .results-table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5rem 0;
  }
  .results-table th,
  .results-table td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid #333;
  }
  .results-table th {
    color: #e94560;
    font-weight: 600;
  }
  .results-table td {
    color: #c0c0c0;
  }

  .debrief {
    margin-top: 1.5rem;
    font-style: italic;
    color: #888;
    line-height: 1.6;
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById('reversal-styles')) return;
  const style = document.createElement('style');
  style.id = 'reversal-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function getApp(): HTMLElement {
  let app = document.getElementById('app');
  if (!app) {
    app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);
  }
  return app;
}

// ─── Render functions ────────────────────────────────────────────────────────

function renderInstructions(actor: AnyActor): void {
  const app = getApp();
  app.innerHTML = `
    <h1>${config.title}</h1>
    <div class="instructions">${config.instructions}</div>
    <button class="primary" id="begin-btn">Begin</button>
  `;
  document.getElementById('begin-btn')!.addEventListener('click', () => {
    actor.send({ type: 'START' });
  });
}

function renderFixation(ctx: ReversalExperimentContext): void {
  const app = getApp();
  const phase = ctx.currentIndex < config.parameters.reversalTrial ? 1 : 2;
  app.innerHTML = `
    <div class="status-bar">
      <span>Trial ${ctx.currentIndex + 1} / ${config.numTrials}</span>
      <span class="phase-indicator">Phase ${phase}</span>
      <span>Total: ${ctx.totalReward}</span>
    </div>
    <div class="fixation">+</div>
  `;
}

function renderStimulus(ctx: ReversalExperimentContext, actor: AnyActor): void {
  const app = getApp();
  const phase = ctx.currentIndex < config.parameters.reversalTrial ? 1 : 2;
  app.innerHTML = `
    <div class="status-bar">
      <span>Trial ${ctx.currentIndex + 1} / ${config.numTrials}</span>
      <span class="phase-indicator">Phase ${phase}</span>
      <span>Total: ${ctx.totalReward}</span>
    </div>
    <div class="arms">
      <div class="arm-box" data-arm="0">
        <span class="label">1</span>
        <span class="hint">press 1</span>
      </div>
      <div class="arm-box" data-arm="1">
        <span class="label">2</span>
        <span class="hint">press 2</span>
      </div>
      <div class="arm-box" data-arm="2">
        <span class="label">3</span>
        <span class="hint">press 3</span>
      </div>
    </div>
  `;

  // Click handlers
  document.querySelectorAll('.arm-box').forEach((el) => {
    el.addEventListener('click', () => {
      const arm = parseInt((el as HTMLElement).dataset.arm!, 10) as 0 | 1 | 2;
      actor.send({ type: 'CHOOSE', arm });
    });
  });

  // Keyboard handler
  const keyHandler = (e: KeyboardEvent) => {
    const map: Record<string, 0 | 1 | 2> = { '1': 0, '2': 1, '3': 2 };
    const arm = map[e.key];
    if (arm !== undefined) {
      document.removeEventListener('keydown', keyHandler);
      actor.send({ type: 'CHOOSE', arm });
    }
  };
  document.addEventListener('keydown', keyHandler);
}

function renderFeedback(ctx: ReversalExperimentContext): void {
  const app = getApp();
  const phase = ctx.currentIndex < config.parameters.reversalTrial ? 1 : 2;

  // Read the latest trial result from the child trial actor's context.
  // Since collectResult hasn't fired yet during the feedback state of the
  // *trial* machine, we inspect the trial actor snapshot.
  const trialRef = (ctx as any).__trialSnapshot;

  // Fallback: use the last response if available, otherwise show from context
  const lastResponse = ctx.responses[ctx.responses.length - 1];

  // We need to get the current trial's data from the invoked actor.
  // The experiment machine's context won't have it yet (collected on done).
  // So we pass the trial snapshot data via the renderer's awareness of the actor tree.

  // For the renderer, we accept optional overrides from main.ts
  const chosenArm = (ctx as any)._feedbackArm ?? lastResponse?.chosenArm ?? null;
  const reward = (ctx as any)._feedbackReward ?? lastResponse?.reward ?? null;
  const totalReward = ctx.totalReward + (reward ?? 0);

  const rewardClass = reward === 1 ? 'reward' : 'no-reward';
  const rewardText = reward === 1 ? '+1 Point!' : '+0';

  app.innerHTML = `
    <div class="status-bar">
      <span>Trial ${ctx.currentIndex + 1} / ${config.numTrials}</span>
      <span class="phase-indicator">Phase ${phase}</span>
      <span>Total: ${totalReward}</span>
    </div>
    <div class="arms">
      ${[0, 1, 2]
        .map(
          (i) => `
        <div class="arm-box${i === chosenArm ? ` chosen ${rewardClass}` : ''}">
          <span class="label">${i + 1}</span>
        </div>
      `
        )
        .join('')}
    </div>
    <div class="feedback-text ${rewardClass}">${rewardText}</div>
    <div class="total-display">Running total: ${totalReward}</div>
  `;
}

function renderResults(ctx: ReversalExperimentContext): void {
  const app = getApp();
  const responses = ctx.responses;
  const reversalTrial = config.parameters.reversalTrial;

  // Split responses into pre/post reversal
  const pre = responses.filter((r) => r.trialIndex < reversalTrial);
  const post = responses.filter((r) => r.trialIndex >= reversalTrial);

  // Pre-reversal: best arm is 0 (highest prob in preReversalProbs)
  const preReversalBestArm = config.parameters.preReversalProbs.indexOf(
    Math.max(...config.parameters.preReversalProbs)
  );
  const postReversalBestArm = config.parameters.postReversalProbs.indexOf(
    Math.max(...config.parameters.postReversalProbs)
  );

  const preAccuracy =
    pre.length > 0 ? pre.filter((r) => r.chosenArm === preReversalBestArm).length / pre.length : 0;
  const postAccuracy =
    post.length > 0
      ? post.filter((r) => r.chosenArm === postReversalBestArm).length / post.length
      : 0;

  // Adaptation speed: how many trials after the reversal point until the
  // participant first chooses the new best arm
  let adaptationTrials = post.length; // default: never adapted
  for (let i = 0; i < post.length; i++) {
    if (post[i].chosenArm === postReversalBestArm) {
      adaptationTrials = i + 1;
      break;
    }
  }

  app.innerHTML = `
    <h2>Results</h2>
    <table class="results-table">
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Total reward</td><td>${ctx.totalReward} / ${config.numTrials}</td></tr>
      <tr><td>Pre-reversal accuracy</td><td>${(preAccuracy * 100).toFixed(1)}%</td></tr>
      <tr><td>Post-reversal accuracy</td><td>${(postAccuracy * 100).toFixed(1)}%</td></tr>
      <tr><td>Adaptation speed</td><td>${adaptationTrials} trial${adaptationTrials !== 1 ? 's' : ''} after reversal</td></tr>
    </table>
    <div class="debrief">${config.debrief}</div>
  `;
}

// ─── Main render dispatcher ──────────────────────────────────────────────────

/**
 * Subscribe this renderer to the experiment actor.
 * It inspects the current state and renders the appropriate screen.
 */
export function createRenderer(actor: AnyActor): () => void {
  injectStyles();

  const render = () => {
    const snapshot = actor.getSnapshot();
    const state = snapshot.value;
    const ctx = snapshot.context as ReversalExperimentContext;

    if (state === 'instructions') {
      renderInstructions(actor);
      return;
    }

    if (state === 'results') {
      renderResults(ctx);
      return;
    }

    // Running state — need to inspect the child trial actor's state
    if (typeof state === 'object' && 'running' in state) {
      const runningState = (state as any).running;

      // When in checkNext, the trial just completed — briefly skip rendering
      // (the machine will immediately transition to active or results)
      if (runningState === 'checkNext') return;

      if (runningState === 'active') {
        // Inspect the child trial actor
        const trialRef = snapshot.children?.['currentTrial'] as AnyActor | undefined;
        if (trialRef) {
          const trialSnap = trialRef.getSnapshot();
          const trialState = trialSnap.value;

          if (trialState === 'fixation') {
            renderFixation(ctx);
          } else if (trialState === 'stimulus') {
            renderStimulus(ctx, trialRef);
          } else if (trialState === 'feedback') {
            // Pass trial-level data for feedback rendering
            const trialCtx = trialSnap.context as any;
            const augCtx = {
              ...ctx,
              _feedbackArm: trialCtx.chosenArm,
              _feedbackReward: trialCtx.reward,
            } as ReversalExperimentContext;
            renderFeedback(augCtx);
          }
        }
      }
    }
  };

  // Subscribe to both experiment and child actor changes
  const sub = actor.subscribe(() => {
    render();

    // Also subscribe to child trial actor for inner state changes
    const snapshot = actor.getSnapshot();
    const trialRef = snapshot.children?.['currentTrial'] as AnyActor | undefined;
    if (trialRef && !(trialRef as any).__rendererSubscribed) {
      (trialRef as any).__rendererSubscribed = true;
      trialRef.subscribe(() => render());
    }
  });

  // Initial render
  render();

  return () => sub.unsubscribe();
}
