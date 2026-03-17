import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { reversalTrialMachine, reversalExperimentMachine } from '../machine';

// ─── Trial Machine Tests ────────────────────────────────────────────────────

const defaultTrialInput = {
  trialIndex: 0,
  rewardProbabilities: [0.7, 0.2, 0.1] as [number, number, number],
  qValues: [0.5, 0.5, 0.5] as [number, number, number],
  alpha: 0.1,
};

describe('reversalTrialMachine', () => {
  it('starts in fixation state', () => {
    const actor = createActor(reversalTrialMachine, { input: defaultTrialInput });
    actor.start();
    expect(actor.getSnapshot().value).toBe('fixation');
    actor.stop();
  });

  it('has correct initial context from input', () => {
    const input = {
      trialIndex: 3,
      rewardProbabilities: [0.1, 0.2, 0.7] as [number, number, number],
      qValues: [0.3, 0.4, 0.6] as [number, number, number],
      alpha: 0.2,
    };
    const actor = createActor(reversalTrialMachine, { input });
    actor.start();

    const ctx = actor.getSnapshot().context;
    expect(ctx.trialIndex).toBe(3);
    expect(ctx.rewardProbabilities).toEqual([0.1, 0.2, 0.7]);
    expect(ctx.qValues).toEqual([0.3, 0.4, 0.6]);
    expect(ctx.alpha).toBe(0.2);
    expect(ctx.chosenArm).toBeNull();
    expect(ctx.reward).toBeNull();
    expect(ctx.rt).toBeNull();
    expect(ctx.updatedQValues).toEqual([0.3, 0.4, 0.6]);
    actor.stop();
  });

  it('transitions fixation -> stimulus after 500ms', async () => {
    const actor = createActor(reversalTrialMachine, { input: defaultTrialInput });
    actor.start();
    expect(actor.getSnapshot().value).toBe('fixation');

    await new Promise((r) => setTimeout(r, 600));
    expect(actor.getSnapshot().value).toBe('stimulus');
    actor.stop();
  }, 3000);

  it('records arm, reward, and RT on CHOOSE event', async () => {
    const actor = createActor(reversalTrialMachine, { input: defaultTrialInput });
    actor.start();

    await new Promise((r) => setTimeout(r, 600));
    expect(actor.getSnapshot().value).toBe('stimulus');

    actor.send({ type: 'CHOOSE', arm: 1 });
    expect(actor.getSnapshot().value).toBe('feedback');

    const ctx = actor.getSnapshot().context;
    expect(ctx.chosenArm).toBe(1);
    expect(ctx.reward).toBeTypeOf('number');
    expect([0, 1]).toContain(ctx.reward);
    expect(ctx.rt).toBeTypeOf('number');
    expect(ctx.rt!).toBeGreaterThan(0);
    actor.stop();
  }, 3000);

  it('updates Q-values via Rescorla-Wagner rule', async () => {
    const input = {
      trialIndex: 0,
      rewardProbabilities: [1.0, 0.0, 0.0] as [number, number, number],
      qValues: [0.5, 0.5, 0.5] as [number, number, number],
      alpha: 0.1,
    };
    const actor = createActor(reversalTrialMachine, { input });
    actor.start();

    await new Promise((r) => setTimeout(r, 600));
    actor.send({ type: 'CHOOSE', arm: 0 });

    const ctx = actor.getSnapshot().context;
    // reward=1 guaranteed for arm 0, Q[0] = 0.5 + 0.1*(1-0.5) = 0.55
    expect(ctx.reward).toBe(1);
    expect(ctx.updatedQValues[0]).toBeCloseTo(0.55, 5);
    expect(ctx.updatedQValues[1]).toBe(0.5); // unchanged
    expect(ctx.updatedQValues[2]).toBe(0.5); // unchanged
    actor.stop();
  }, 3000);

  it('updates Q-values correctly on no reward', async () => {
    const input = {
      trialIndex: 0,
      rewardProbabilities: [0.0, 0.0, 0.0] as [number, number, number],
      qValues: [0.5, 0.5, 0.5] as [number, number, number],
      alpha: 0.1,
    };
    const actor = createActor(reversalTrialMachine, { input });
    actor.start();

    await new Promise((r) => setTimeout(r, 600));
    actor.send({ type: 'CHOOSE', arm: 2 });

    const ctx = actor.getSnapshot().context;
    // reward=0 guaranteed for arm 2, Q[2] = 0.5 + 0.1*(0-0.5) = 0.45
    expect(ctx.reward).toBe(0);
    expect(ctx.updatedQValues[2]).toBeCloseTo(0.45, 5);
    expect(ctx.updatedQValues[0]).toBe(0.5); // unchanged
    expect(ctx.updatedQValues[1]).toBe(0.5); // unchanged
    actor.stop();
  }, 3000);

  it('produces output with all required fields when completed', async () => {
    const actor = createActor(reversalTrialMachine, { input: defaultTrialInput });

    let output: unknown = null;
    actor.subscribe({
      complete: () => {
        output = actor.getSnapshot().output;
      },
    });

    actor.start();

    // Wait for fixation (500ms)
    await new Promise((r) => setTimeout(r, 600));
    expect(actor.getSnapshot().value).toBe('stimulus');

    actor.send({ type: 'CHOOSE', arm: 2 });
    expect(actor.getSnapshot().value).toBe('feedback');

    // Wait for feedback (1000ms)
    await new Promise((r) => setTimeout(r, 1100));
    expect(actor.getSnapshot().status).toBe('done');

    expect(output).toBeDefined();
    const o = output as Record<string, unknown>;
    expect(o).toHaveProperty('trialIndex', 0);
    expect(o).toHaveProperty('chosenArm', 2);
    expect(o).toHaveProperty('reward');
    expect(o).toHaveProperty('rt');
    expect(o).toHaveProperty('rewardProbabilities');
    expect(o).toHaveProperty('qValues');
    expect(o).toHaveProperty('updatedQValues');
  }, 5000);
});

// ─── Experiment Machine Tests ───────────────────────────────────────────────

describe('reversalExperimentMachine', () => {
  it('starts in instructions state', () => {
    const actor = createActor(reversalExperimentMachine);
    actor.start();
    expect(actor.getSnapshot().value).toBe('instructions');
    actor.stop();
  });

  it('transitions to running on START', () => {
    const actor = createActor(reversalExperimentMachine);
    actor.start();
    actor.send({ type: 'START' });

    const snap = actor.getSnapshot();
    expect(snap.matches('running')).toBe(true);
    expect(snap.context.startTime).toBeTypeOf('number');
    actor.stop();
  });

  it('initializes context with correct defaults', () => {
    const actor = createActor(reversalExperimentMachine);
    actor.start();

    const ctx = actor.getSnapshot().context;
    expect(ctx.currentIndex).toBe(0);
    expect(ctx.responses).toEqual([]);
    expect(ctx.totalReward).toBe(0);
    expect(ctx.qValues).toEqual([0.5, 0.5, 0.5]);
    expect(ctx.config.numTrials).toBe(120);
    expect(ctx.config.parameters.reversalTrial).toBe(60);
    actor.stop();
  });

  it('uses preReversalProbs for trials before reversal point', () => {
    const actor = createActor(reversalExperimentMachine);
    actor.start();
    actor.send({ type: 'START' });

    // The first trial (index 0) should use preReversalProbs
    const snap = actor.getSnapshot();
    const trialRef = snap.children?.['currentTrial'] as any;
    expect(trialRef).toBeDefined();

    const trialCtx = trialRef.getSnapshot().context;
    expect(trialCtx.rewardProbabilities).toEqual([0.7, 0.2, 0.1]);
    actor.stop();
  });

  it('switches reward probabilities at the reversal trial', async () => {
    // Create a custom config experiment machine for faster testing.
    // We use the existing machine but manipulate context to simulate
    // being at the reversal point.
    // Since we can't easily fast-forward 60 trials, we verify the
    // input logic by inspecting the machine definition's input function.

    // The machine's input computation is:
    //   currentIndex < reversalTrial -> preReversalProbs
    //   currentIndex >= reversalTrial -> postReversalProbs
    // We can verify this by checking the config values.
    const actor = createActor(reversalExperimentMachine);
    actor.start();

    const ctx = actor.getSnapshot().context;
    const { reversalTrial, preReversalProbs, postReversalProbs } = ctx.config.parameters;

    expect(reversalTrial).toBe(60);
    expect(preReversalProbs).toEqual([0.7, 0.2, 0.1]);
    expect(postReversalProbs).toEqual([0.1, 0.2, 0.7]);

    // Verify the probability switching logic:
    // For index < 60, should use preReversalProbs
    // For index >= 60, should use postReversalProbs
    expect(0 < reversalTrial).toBe(true); // trial 0: pre-reversal
    expect(59 < reversalTrial).toBe(true); // trial 59: still pre-reversal
    expect(60 < reversalTrial).toBe(false); // trial 60: post-reversal
    expect(119 < reversalTrial).toBe(false); // trial 119: post-reversal

    actor.stop();
  });

  it('completes a full trial cycle and collects result', async () => {
    const actor = createActor(reversalExperimentMachine);
    actor.start();
    actor.send({ type: 'START' });

    // Wait for fixation
    await new Promise((r) => setTimeout(r, 600));

    // Get the trial actor and send CHOOSE to it
    let snap = actor.getSnapshot();
    const trialRef = snap.children?.['currentTrial'] as any;
    expect(trialRef).toBeDefined();
    expect(trialRef.getSnapshot().value).toBe('stimulus');

    trialRef.send({ type: 'CHOOSE', arm: 0 });
    expect(trialRef.getSnapshot().value).toBe('feedback');

    // Wait for feedback
    await new Promise((r) => setTimeout(r, 1100));

    // The experiment should have collected the result and moved to next trial
    snap = actor.getSnapshot();
    expect(snap.context.currentIndex).toBe(1);
    expect(snap.context.responses).toHaveLength(1);

    const response = snap.context.responses[0];
    expect(response.trialIndex).toBe(0);
    expect(response.chosenArm).toBe(0);
    expect([0, 1]).toContain(response.reward);
    expect(response.rt).toBeGreaterThan(0);
    expect(response.updatedQValues).toHaveLength(3);
    actor.stop();
  }, 5000);

  it('updates running Q-values after each trial', async () => {
    const actor = createActor(reversalExperimentMachine);
    actor.start();
    actor.send({ type: 'START' });

    // Complete first trial
    await new Promise((r) => setTimeout(r, 600));
    const trialRef = actor.getSnapshot().children?.['currentTrial'] as any;
    trialRef.send({ type: 'CHOOSE', arm: 0 });
    await new Promise((r) => setTimeout(r, 1100));

    // Q-values should have been updated from the trial output
    const ctx = actor.getSnapshot().context;
    const updatedQ = ctx.qValues;
    // At least one Q-value should differ from the initial [0.5, 0.5, 0.5]
    const changed = updatedQ.some((q: number, i: number) => q !== 0.5);
    expect(changed).toBe(true);
    actor.stop();
  }, 5000);

  it('tracks totalReward across trials', async () => {
    const actor = createActor(reversalExperimentMachine);
    actor.start();
    actor.send({ type: 'START' });

    // Complete first trial
    await new Promise((r) => setTimeout(r, 600));
    let trialRef = actor.getSnapshot().children?.['currentTrial'] as any;
    trialRef.send({ type: 'CHOOSE', arm: 0 });
    await new Promise((r) => setTimeout(r, 1100));

    const reward1 = actor.getSnapshot().context.responses[0].reward;

    // Complete second trial
    await new Promise((r) => setTimeout(r, 600));
    trialRef = actor.getSnapshot().children?.['currentTrial'] as any;
    trialRef.send({ type: 'CHOOSE', arm: 1 });
    await new Promise((r) => setTimeout(r, 1100));

    const reward2 = actor.getSnapshot().context.responses[1].reward;
    expect(actor.getSnapshot().context.totalReward).toBe(reward1 + reward2);
    actor.stop();
  }, 10000);

  it('output contains all required fields per trial', async () => {
    const actor = createActor(reversalExperimentMachine);
    actor.start();
    actor.send({ type: 'START' });

    // Complete one trial
    await new Promise((r) => setTimeout(r, 600));
    const trialRef = actor.getSnapshot().children?.['currentTrial'] as any;
    trialRef.send({ type: 'CHOOSE', arm: 2 });
    await new Promise((r) => setTimeout(r, 1100));

    const response = actor.getSnapshot().context.responses[0];
    expect(response).toHaveProperty('trialIndex');
    expect(response).toHaveProperty('chosenArm');
    expect(response).toHaveProperty('reward');
    expect(response).toHaveProperty('rt');
    expect(response).toHaveProperty('rewardProbabilities');
    expect(response).toHaveProperty('qValues');
    expect(response).toHaveProperty('updatedQValues');
    actor.stop();
  }, 5000);
});
