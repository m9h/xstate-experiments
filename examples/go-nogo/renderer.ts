import type { AnyActor } from 'xstate';
import type { ExperimentContext, GoNoGoTrialContext } from './machine';
import config from './config.json';

/**
 * DOM renderer for the Go/No-Go experiment.
 *
 * Subscribes to the experiment actor's state changes and renders
 * the appropriate screen (instructions, fixation, stimulus, feedback, results).
 */
export function createRenderer(
  app: HTMLElement,
  experimentActor: AnyActor,
) {
  let currentTrialActor: AnyActor | null = null;
  let trialUnsub: (() => void) | null = null;

  experimentActor.subscribe((snapshot) => {
    const state = snapshot.value;
    const context = snapshot.context as ExperimentContext;

    if (state === 'instructions') {
      renderInstructions(app, experimentActor);
    } else if (typeof state === 'object' && 'running' in state) {
      // When running, we need to subscribe to the trial actor
      const trialRef = snapshot.children?.currentTrial as AnyActor | undefined;
      if (trialRef && trialRef !== currentTrialActor) {
        // Clean up previous subscription
        if (trialUnsub) trialUnsub();
        currentTrialActor = trialRef;
        // Render initial trial state
        renderTrialState(app, trialRef.getSnapshot());
        // Subscribe to trial state changes
        trialUnsub = trialRef.subscribe((trialSnap) => {
          renderTrialState(app, trialSnap);
        }).unsubscribe;
      }
    } else if (state === 'results') {
      if (trialUnsub) {
        trialUnsub();
        trialUnsub = null;
      }
      currentTrialActor = null;
      renderResults(app, context);
    }
  });
}

function renderInstructions(app: HTMLElement, actor: AnyActor) {
  app.innerHTML = `
    <div class="screen instructions-screen">
      <h1>${config.title}</h1>
      <p class="instructions-text">${config.instructions.replace(/\n/g, '<br>')}</p>
      <button id="begin-btn" class="btn">Begin</button>
    </div>
  `;

  const btn = app.querySelector('#begin-btn')!;
  btn.addEventListener('click', () => actor.send({ type: 'START' }), { once: true });
}

function renderTrialState(app: HTMLElement, trialSnap: any) {
  const state = trialSnap.value as string;
  const ctx = trialSnap.context as GoNoGoTrialContext;

  switch (state) {
    case 'fixation':
      renderFixation(app);
      break;
    case 'stimulus':
      renderStimulus(app, ctx);
      break;
    case 'evaluation':
      // Transient state — no render needed
      break;
    case 'feedback':
      renderFeedback(app, ctx);
      break;
    // 'done' is handled by experiment-level subscription
  }
}

function renderFixation(app: HTMLElement) {
  app.innerHTML = `
    <div class="screen fixation-screen">
      <span class="fixation-cross">+</span>
    </div>
  `;
}

function renderStimulus(app: HTMLElement, ctx: GoNoGoTrialContext) {
  const color = ctx.trialType === 'go' ? '#4ade80' : '#f87171';
  app.innerHTML = `
    <div class="screen stimulus-screen">
      <span class="stimulus-letter" style="color: ${color}">${ctx.stimulus}</span>
    </div>
  `;
}

function renderFeedback(app: HTMLElement, ctx: GoNoGoTrialContext) {
  let message: string;
  let color: string;

  if (ctx.correct) {
    message = 'Correct!';
    color = '#4ade80';
  } else if (ctx.trialType === 'go' && !ctx.responded) {
    message = 'Too slow!';
    color = '#facc15';
  } else {
    message = 'Incorrect';
    color = '#f87171';
  }

  app.innerHTML = `
    <div class="screen feedback-screen">
      <span class="feedback-text" style="color: ${color}">${message}</span>
    </div>
  `;
}

function renderResults(app: HTMLElement, context: ExperimentContext) {
  const totalGo = context.trials.filter(t => t.trialType === 'go').length;
  const totalNogo = context.trials.filter(t => t.trialType === 'nogo').length;

  const meanGoRT = context.goRT.length > 0
    ? (context.goRT.reduce((a, b) => a + b, 0) / context.goRT.length).toFixed(1)
    : 'N/A';

  const hitRate = totalGo > 0
    ? ((context.hits / totalGo) * 100).toFixed(1)
    : 'N/A';

  const commissionRate = totalNogo > 0
    ? ((context.commissionErrors / totalNogo) * 100).toFixed(1)
    : 'N/A';

  const omissionRate = totalGo > 0
    ? ((context.omissionErrors / totalGo) * 100).toFixed(1)
    : 'N/A';

  app.innerHTML = `
    <div class="screen results-screen">
      <h1>Results</h1>
      <p class="debrief-text">${config.debrief.replace(/\n/g, '<br>')}</p>
      <table class="results-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Mean Go RT</td>
            <td>${meanGoRT} ms</td>
          </tr>
          <tr>
            <td>Hit rate (Go correct)</td>
            <td>${hitRate}%</td>
          </tr>
          <tr>
            <td>Commission errors (No-Go failures)</td>
            <td>${context.commissionErrors} / ${totalNogo} (${commissionRate}%)</td>
          </tr>
          <tr>
            <td>Omission errors (Go misses)</td>
            <td>${context.omissionErrors} / ${totalGo} (${omissionRate}%)</td>
          </tr>
          <tr>
            <td>Total trials</td>
            <td>${context.responses.length}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}
