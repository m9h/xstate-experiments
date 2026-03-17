import type { AnyActor } from 'xstate';
import type {
  ExperimentContext,
  TrialContext,
  Stage2Context,
  TrialOutput,
} from './machine';
import config from './config.json';

// =============================================================================
// Color palette
// =============================================================================

const COLORS = {
  rocket0: '#3b82f6',    // Blue
  rocket1: '#f97316',    // Orange
  planet0: '#a855f7',    // Purple
  planet1: '#14b8a6',    // Teal
  reward: '#4ade80',     // Green
  noReward: '#f87171',   // Red
  text: '#e2e8f0',       // Light gray
  heading: '#7dd3fc',    // Sky blue
  bg: '#1a1a2e',         // Dark background
  boxBg: '#1e1e3a',      // Box background
};

const PLANET_NAMES = ['Planet A', 'Planet B'] as const;

// =============================================================================
// Renderer
// =============================================================================

/**
 * DOM renderer for the Two-Step Task.
 *
 * Subscribes to experiment actor state, and when running, also subscribes
 * to the current trial actor (and its nested stage2 actor).
 */
export function createRenderer(
  app: HTMLElement,
  experimentActor: AnyActor,
) {
  let currentTrialActor: AnyActor | null = null;
  let trialUnsub: (() => void) | null = null;
  let currentStage2Actor: AnyActor | null = null;
  let stage2Unsub: (() => void) | null = null;

  experimentActor.subscribe((snapshot) => {
    const state = snapshot.value;
    const context = snapshot.context as ExperimentContext;

    if (state === 'instructions') {
      renderInstructions(app, experimentActor);
    } else if (typeof state === 'object' && 'running' in state) {
      const trialRef = snapshot.children?.currentTrial as AnyActor | undefined;
      if (trialRef && trialRef !== currentTrialActor) {
        // Clean up previous subscriptions
        if (stage2Unsub) { stage2Unsub(); stage2Unsub = null; }
        if (trialUnsub) { trialUnsub(); trialUnsub = null; }
        currentTrialActor = trialRef;
        currentStage2Actor = null;

        renderTrialState(app, trialRef.getSnapshot(), context);
        trialUnsub = trialRef.subscribe((trialSnap) => {
          // Check for nested stage2 actor
          const stage2Ref = trialSnap.children?.stage2 as AnyActor | undefined;
          if (stage2Ref && stage2Ref !== currentStage2Actor) {
            if (stage2Unsub) { stage2Unsub(); stage2Unsub = null; }
            currentStage2Actor = stage2Ref;
            renderStage2(app, stage2Ref.getSnapshot(), trialSnap.context as TrialContext, context);
            stage2Unsub = stage2Ref.subscribe((s2Snap) => {
              renderStage2(app, s2Snap, trialSnap.context as TrialContext, context);
            }).unsubscribe;
          } else {
            renderTrialState(app, trialSnap, context);
          }
        }).unsubscribe;
      }
    } else if (state === 'results') {
      if (stage2Unsub) { stage2Unsub(); stage2Unsub = null; }
      if (trialUnsub) { trialUnsub(); trialUnsub = null; }
      currentTrialActor = null;
      currentStage2Actor = null;
      renderResults(app, context);
    }
  });
}

// =============================================================================
// Screen renderers
// =============================================================================

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

function renderTrialState(app: HTMLElement, trialSnap: any, expCtx: ExperimentContext) {
  const state = trialSnap.value as string;
  const ctx = trialSnap.context as TrialContext;

  switch (state) {
    case 'fixation':
      renderFixation(app, expCtx);
      break;
    case 'stage1':
      renderStage1(app, expCtx);
      break;
    case 'transition':
      renderTransition(app, ctx, expCtx);
      break;
    // stage2 is handled by nested subscription
    case 'feedback':
      renderFeedback(app, ctx, expCtx);
      break;
    case 'iti':
      renderITI(app);
      break;
  }
}

function renderFixation(app: HTMLElement, expCtx: ExperimentContext) {
  app.innerHTML = `
    <div class="screen fixation-screen">
      <div class="trial-counter">Trial ${expCtx.currentIndex + 1} / ${config.numTrials}</div>
      <span class="fixation-cross">+</span>
    </div>
  `;
}

function renderStage1(app: HTMLElement, expCtx: ExperimentContext) {
  app.innerHTML = `
    <div class="screen stage1-screen">
      <div class="trial-counter">Trial ${expCtx.currentIndex + 1} / ${config.numTrials} &mdash; Total: ${expCtx.totalReward}</div>
      <p class="prompt">Choose a rocket</p>
      <div class="choice-row">
        <div class="choice-box rocket rocket-0" data-option="0">
          <div class="choice-label">Rocket 1</div>
          <div class="choice-key">1 / &larr;</div>
        </div>
        <div class="choice-box rocket rocket-1" data-option="1">
          <div class="choice-label">Rocket 2</div>
          <div class="choice-key">2 / &rarr;</div>
        </div>
      </div>
    </div>
  `;
}

function renderTransition(app: HTMLElement, ctx: TrialContext, expCtx: ExperimentContext) {
  const planet = ctx.planet!;
  const planetColor = planet === 0 ? COLORS.planet0 : COLORS.planet1;
  const planetName = PLANET_NAMES[planet];
  const transLabel = ctx.transitionType === 'common' ? '' : ' (rare transition!)';

  app.innerHTML = `
    <div class="screen transition-screen">
      <div class="trial-counter">Trial ${expCtx.currentIndex + 1} / ${config.numTrials}</div>
      <div class="travel-message" style="color: ${planetColor}">
        You traveled to ${planetName}!${transLabel}
      </div>
    </div>
  `;
}

function renderStage2(app: HTMLElement, s2Snap: any, trialCtx: TrialContext, expCtx: ExperimentContext) {
  const s2State = s2Snap.value as string;
  if (s2State !== 'stimulus') return;

  const ctx = s2Snap.context as Stage2Context;
  const planet = ctx.planet;
  const planetColor = planet === 0 ? COLORS.planet0 : COLORS.planet1;
  const planetName = PLANET_NAMES[planet];

  app.innerHTML = `
    <div class="screen stage2-screen">
      <div class="trial-counter">Trial ${expCtx.currentIndex + 1} / ${config.numTrials} &mdash; Total: ${expCtx.totalReward}</div>
      <div class="planet-label" style="color: ${planetColor}">${planetName}</div>
      <p class="prompt">Choose an option</p>
      <div class="choice-row">
        <div class="choice-box option planet-option" style="border-color: ${planetColor}" data-option="0">
          <div class="choice-label">Option 1</div>
          <div class="choice-key">1 / &larr;</div>
        </div>
        <div class="choice-box option planet-option" style="border-color: ${planetColor}" data-option="1">
          <div class="choice-label">Option 2</div>
          <div class="choice-key">2 / &rarr;</div>
        </div>
      </div>
    </div>
  `;
}

function renderFeedback(app: HTMLElement, ctx: TrialContext, expCtx: ExperimentContext) {
  const rewarded = ctx.reward === 1;
  const color = rewarded ? COLORS.reward : COLORS.noReward;
  const message = rewarded ? 'Reward!' : 'No reward';

  app.innerHTML = `
    <div class="screen feedback-screen">
      <div class="trial-counter">Trial ${expCtx.currentIndex + 1} / ${config.numTrials}</div>
      <span class="feedback-text" style="color: ${color}">${message}</span>
      <div class="reward-total">Total: ${expCtx.totalReward + (ctx.reward ?? 0)}</div>
    </div>
  `;
}

function renderITI(app: HTMLElement) {
  app.innerHTML = `<div class="screen iti-screen"></div>`;
}

function renderResults(app: HTMLElement, context: ExperimentContext) {
  const responses = context.responses;
  const totalReward = context.totalReward;

  // Compute model-free diagnostic: stay probabilities
  const stayProbs = computeStayProbabilities(responses);

  // CSV data for download
  const csvHeader = 'trial,stage1Choice,stage2Choice,planet,transitionType,reward,stage1RT,stage2RT';
  const csvRows = responses.map(r =>
    `${r.trialIndex},${r.stage1Choice},${r.stage2Choice},${r.planet},${r.transitionType},${r.reward},${r.stage1RT.toFixed(1)},${r.stage2RT.toFixed(1)}`
  );
  const csvContent = [csvHeader, ...csvRows].join('\n');
  const csvBlob = new Blob([csvContent], { type: 'text/csv' });
  const csvUrl = URL.createObjectURL(csvBlob);

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
            <td>Total reward</td>
            <td>${totalReward} / ${responses.length}</td>
          </tr>
          <tr>
            <td>Reward rate</td>
            <td>${responses.length > 0 ? ((totalReward / responses.length) * 100).toFixed(1) : 'N/A'}%</td>
          </tr>
          <tr>
            <td>Mean Stage 1 RT</td>
            <td>${meanRT(responses.map(r => r.stage1RT))} ms</td>
          </tr>
          <tr>
            <td>Mean Stage 2 RT</td>
            <td>${meanRT(responses.map(r => r.stage2RT))} ms</td>
          </tr>
          <tr>
            <td>Common transitions</td>
            <td>${responses.filter(r => r.transitionType === 'common').length} (${((responses.filter(r => r.transitionType === 'common').length / responses.length) * 100).toFixed(1)}%)</td>
          </tr>
        </tbody>
      </table>

      <h2 class="section-heading">Stay Probabilities (Model-Free Diagnostic)</h2>
      <table class="results-table">
        <thead>
          <tr>
            <th>Condition</th>
            <th>P(stay)</th>
            <th>N</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Common + Reward</td>
            <td>${stayProbs.commonRewarded.toFixed(3)}</td>
            <td>${stayProbs.commonRewardedN}</td>
          </tr>
          <tr>
            <td>Common + No Reward</td>
            <td>${stayProbs.commonUnrewarded.toFixed(3)}</td>
            <td>${stayProbs.commonUnrewardedN}</td>
          </tr>
          <tr>
            <td>Rare + Reward</td>
            <td>${stayProbs.rareRewarded.toFixed(3)}</td>
            <td>${stayProbs.rareRewardedN}</td>
          </tr>
          <tr>
            <td>Rare + No Reward</td>
            <td>${stayProbs.rareUnrewarded.toFixed(3)}</td>
            <td>${stayProbs.rareUnrewardedN}</td>
          </tr>
        </tbody>
      </table>
      <p class="diagnostic-note">
        Model-free: high stay after reward regardless of transition type.<br>
        Model-based: higher stay after common+reward and rare+no-reward.
      </p>

      <a href="${csvUrl}" download="two-step-data.csv" class="btn download-btn">Download Trial Data (CSV)</a>
    </div>
  `;
}

// =============================================================================
// Helpers
// =============================================================================

function meanRT(rts: number[]): string {
  if (rts.length === 0) return 'N/A';
  return (rts.reduce((a, b) => a + b, 0) / rts.length).toFixed(1);
}

interface StayProbabilities {
  commonRewarded: number;
  commonRewardedN: number;
  commonUnrewarded: number;
  commonUnrewardedN: number;
  rareRewarded: number;
  rareRewardedN: number;
  rareUnrewarded: number;
  rareUnrewardedN: number;
}

/**
 * Compute stay probabilities conditioned on previous trial's transition type
 * and reward. A "stay" means choosing the same stage-1 rocket as the previous trial.
 */
function computeStayProbabilities(responses: TrialOutput[]): StayProbabilities {
  let commonRewardedStay = 0, commonRewardedTotal = 0;
  let commonUnrewardedStay = 0, commonUnrewardedTotal = 0;
  let rareRewardedStay = 0, rareRewardedTotal = 0;
  let rareUnrewardedStay = 0, rareUnrewardedTotal = 0;

  for (let i = 1; i < responses.length; i++) {
    const prev = responses[i - 1];
    const curr = responses[i];
    const stayed = curr.stage1Choice === prev.stage1Choice;

    if (prev.transitionType === 'common' && prev.reward === 1) {
      commonRewardedTotal++;
      if (stayed) commonRewardedStay++;
    } else if (prev.transitionType === 'common' && prev.reward === 0) {
      commonUnrewardedTotal++;
      if (stayed) commonUnrewardedStay++;
    } else if (prev.transitionType === 'rare' && prev.reward === 1) {
      rareRewardedTotal++;
      if (stayed) rareRewardedStay++;
    } else if (prev.transitionType === 'rare' && prev.reward === 0) {
      rareUnrewardedTotal++;
      if (stayed) rareUnrewardedStay++;
    }
  }

  return {
    commonRewarded: commonRewardedTotal > 0 ? commonRewardedStay / commonRewardedTotal : 0,
    commonRewardedN: commonRewardedTotal,
    commonUnrewarded: commonUnrewardedTotal > 0 ? commonUnrewardedStay / commonUnrewardedTotal : 0,
    commonUnrewardedN: commonUnrewardedTotal,
    rareRewarded: rareRewardedTotal > 0 ? rareRewardedStay / rareRewardedTotal : 0,
    rareRewardedN: rareRewardedTotal,
    rareUnrewarded: rareUnrewardedTotal > 0 ? rareUnrewardedStay / rareUnrewardedTotal : 0,
    rareUnrewardedN: rareUnrewardedTotal,
  };
}
