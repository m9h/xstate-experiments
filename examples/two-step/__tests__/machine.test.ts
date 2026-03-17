import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import {
  twoStepStage2Machine,
  twoStepTrialMachine,
  twoStepExperimentMachine,
  clamp,
  driftRewardProbs,
  buildTransitionProbs,
  initRewardProbs,
} from '../machine';
import type { Stage2Output, TrialOutput } from '../machine';

// =============================================================================
// Utility functions
// =============================================================================

describe('clamp', () => {
  it('clamps values to range', () => {
    expect(clamp(0.5, 0.25, 0.75)).toBe(0.5);
    expect(clamp(0.1, 0.25, 0.75)).toBe(0.25);
    expect(clamp(0.9, 0.25, 0.75)).toBe(0.75);
  });
});

describe('buildTransitionProbs', () => {
  it('builds correct transition matrix', () => {
    const tp = buildTransitionProbs();
    // Rocket 0 -> Planet 0 with p=0.7, Planet 1 with p=0.3
    expect(tp[0][0]).toBeCloseTo(0.7);
    expect(tp[0][1]).toBeCloseTo(0.3);
    // Rocket 1 -> Planet 0 with p=0.3, Planet 1 with p=0.7
    expect(tp[1][0]).toBeCloseTo(0.3);
    expect(tp[1][1]).toBeCloseTo(0.7);
  });

  it('rows sum to 1', () => {
    const tp = buildTransitionProbs();
    expect(tp[0][0] + tp[0][1]).toBeCloseTo(1.0);
    expect(tp[1][0] + tp[1][1]).toBeCloseTo(1.0);
  });
});

describe('initRewardProbs', () => {
  it('initializes all probabilities at 0.5', () => {
    const rp = initRewardProbs();
    expect(rp).toEqual([[0.5, 0.5], [0.5, 0.5]]);
  });
});

describe('driftRewardProbs', () => {
  it('returns a 2x2 matrix', () => {
    const rp = driftRewardProbs([[0.5, 0.5], [0.5, 0.5]]);
    expect(rp).toHaveLength(2);
    expect(rp[0]).toHaveLength(2);
    expect(rp[1]).toHaveLength(2);
  });

  it('keeps values within [rewardMin, rewardMax]', () => {
    // Run many drift steps from an extreme starting point
    let probs: [[number, number], [number, number]] = [[0.25, 0.75], [0.25, 0.75]];
    for (let i = 0; i < 1000; i++) {
      probs = driftRewardProbs(probs);
      for (const row of probs) {
        for (const val of row) {
          expect(val).toBeGreaterThanOrEqual(0.25);
          expect(val).toBeLessThanOrEqual(0.75);
        }
      }
    }
  });

  it('values drift over many steps (not constant)', () => {
    let probs: [[number, number], [number, number]] = [[0.5, 0.5], [0.5, 0.5]];
    const initial00 = probs[0][0];
    let changed = false;
    for (let i = 0; i < 100; i++) {
      probs = driftRewardProbs(probs);
      if (Math.abs(probs[0][0] - initial00) > 0.001) {
        changed = true;
        break;
      }
    }
    expect(changed).toBe(true);
  });
});

// =============================================================================
// Stage 2 Machine
// =============================================================================

describe('twoStepStage2Machine', () => {
  const defaultInput = {
    planet: 0 as const,
    rewardProbs: [0.8, 0.2] as [number, number],
    trialIndex: 0,
  };

  it('starts in stimulus state', () => {
    const actor = createActor(twoStepStage2Machine, { input: defaultInput });
    actor.start();
    expect(actor.getSnapshot().value).toBe('stimulus');
    actor.stop();
  });

  it('transitions to done on CHOOSE', () => {
    const actor = createActor(twoStepStage2Machine, { input: defaultInput });
    actor.start();

    actor.send({ type: 'CHOOSE', option: 0 });
    expect(actor.getSnapshot().status).toBe('done');
    actor.stop();
  });

  it('records choice, reward, and RT on CHOOSE', () => {
    const actor = createActor(twoStepStage2Machine, { input: defaultInput });

    let output: Stage2Output | null = null;
    actor.subscribe({
      complete: () => {
        output = actor.getSnapshot().output as Stage2Output;
      },
    });

    actor.start();
    actor.send({ type: 'CHOOSE', option: 1 });

    expect(output).not.toBeNull();
    expect(output!.chosenOption).toBe(1);
    expect(output!.planet).toBe(0);
    expect(typeof output!.reward).toBe('number');
    expect([0, 1]).toContain(output!.reward);
    expect(output!.rt).toBeTypeOf('number');
    expect(output!.rt).toBeGreaterThanOrEqual(0);
  });

  it('reward follows Bernoulli distribution', () => {
    // With rewardProb = 1.0, should always reward
    const actor1 = createActor(twoStepStage2Machine, {
      input: { planet: 0 as const, rewardProbs: [1.0, 0.0] as [number, number], trialIndex: 0 },
    });
    let out1: Stage2Output | null = null;
    actor1.subscribe({ complete: () => { out1 = actor1.getSnapshot().output as Stage2Output; } });
    actor1.start();
    actor1.send({ type: 'CHOOSE', option: 0 });
    expect(out1!.reward).toBe(1);

    // With rewardProb = 0.0, should never reward
    const actor2 = createActor(twoStepStage2Machine, {
      input: { planet: 0 as const, rewardProbs: [0.0, 1.0] as [number, number], trialIndex: 0 },
    });
    let out2: Stage2Output | null = null;
    actor2.subscribe({ complete: () => { out2 = actor2.getSnapshot().output as Stage2Output; } });
    actor2.start();
    actor2.send({ type: 'CHOOSE', option: 0 });
    expect(out2!.reward).toBe(0);
  });
});

// =============================================================================
// Trial Machine
// =============================================================================

describe('twoStepTrialMachine', () => {
  const defaultTrialInput = {
    trialIndex: 0,
    transitionProbs: [[0.7, 0.3], [0.3, 0.7]] as [[number, number], [number, number]],
    rewardProbs: [[0.8, 0.2], [0.3, 0.7]] as [[number, number], [number, number]],
    stage1Timeout: 3000,
    stage2Timeout: 3000,
  };

  it('starts in fixation state', () => {
    const actor = createActor(twoStepTrialMachine, { input: defaultTrialInput });
    actor.start();
    expect(actor.getSnapshot().value).toBe('fixation');
    actor.stop();
  });

  it('transitions fixation -> stage1 after delay', async () => {
    const actor = createActor(twoStepTrialMachine, { input: defaultTrialInput });
    actor.start();
    expect(actor.getSnapshot().value).toBe('fixation');

    // fixationDuration is 500ms
    await new Promise(r => setTimeout(r, 600));
    expect(actor.getSnapshot().value).toBe('stage1');
    actor.stop();
  });

  it('stage1 CHOOSE transitions to transition state', async () => {
    const actor = createActor(twoStepTrialMachine, { input: defaultTrialInput });
    actor.start();

    await new Promise(r => setTimeout(r, 600));
    expect(actor.getSnapshot().value).toBe('stage1');

    actor.send({ type: 'CHOOSE', option: 0 });
    expect(actor.getSnapshot().value).toBe('transition');

    const ctx = actor.getSnapshot().context;
    expect(ctx.stage1Choice).toBe(0);
    expect(ctx.stage1RT).toBeTypeOf('number');
    expect(ctx.stage1RT!).toBeGreaterThanOrEqual(0);
    expect(ctx.planet).not.toBeNull();
    expect([0, 1]).toContain(ctx.planet);
    expect(['common', 'rare']).toContain(ctx.transitionType);

    actor.stop();
  });

  it('after transition delay, stage2 is invoked', async () => {
    const actor = createActor(twoStepTrialMachine, { input: defaultTrialInput });
    actor.start();

    // Wait for fixation
    await new Promise(r => setTimeout(r, 600));
    actor.send({ type: 'CHOOSE', option: 1 });
    expect(actor.getSnapshot().value).toBe('transition');

    // Transition delay is 300ms
    await new Promise(r => setTimeout(r, 400));
    expect(actor.getSnapshot().value).toBe('stage2');

    // The stage2 actor should be spawned
    const snap = actor.getSnapshot();
    expect(snap.children?.stage2).toBeDefined();

    actor.stop();
  });

  it('stage2 CHOOSE produces reward and transitions to feedback', async () => {
    const actor = createActor(twoStepTrialMachine, { input: defaultTrialInput });

    let output: TrialOutput | null = null;
    actor.subscribe({
      complete: () => {
        output = actor.getSnapshot().output as TrialOutput;
      },
    });

    actor.start();

    // fixation -> stage1
    await new Promise(r => setTimeout(r, 600));
    actor.send({ type: 'CHOOSE', option: 0 });

    // transition -> stage2
    await new Promise(r => setTimeout(r, 400));
    expect(actor.getSnapshot().value).toBe('stage2');

    // Send choice to stage2 actor
    const snap = actor.getSnapshot();
    const stage2Ref = snap.children?.stage2;
    expect(stage2Ref).toBeDefined();
    (stage2Ref as any).send({ type: 'CHOOSE', option: 1 });

    // Should now be in feedback
    expect(actor.getSnapshot().value).toBe('feedback');
    const ctx = actor.getSnapshot().context;
    expect(ctx.stage2Choice).toBe(1);
    expect(ctx.stage2RT).toBeTypeOf('number');
    expect([0, 1]).toContain(ctx.reward);

    // feedback (1000ms) -> iti (500ms) -> done
    await new Promise(r => setTimeout(r, 1100));
    const stateAfterFeedback = actor.getSnapshot().value;
    expect(stateAfterFeedback === 'iti' || actor.getSnapshot().status === 'done').toBe(true);

    await new Promise(r => setTimeout(r, 600));
    expect(actor.getSnapshot().status).toBe('done');

    expect(output).not.toBeNull();
    expect(output!.trialIndex).toBe(0);
    expect(output!.stage1Choice).toBe(0);
    expect(output!.stage2Choice).toBe(1);
    expect([0, 1]).toContain(output!.planet);
    expect(['common', 'rare']).toContain(output!.transitionType);
    expect([0, 1]).toContain(output!.reward);
    expect(output!.stage1RT).toBeTypeOf('number');
    expect(output!.stage2RT).toBeTypeOf('number');
  }, 10000);

  it('transition probabilities follow commonTransitionProb', async () => {
    // Test the transition logic by running a moderate number of trials.
    // We verify statistically that the common transition rate is near 0.7.
    const N = 50;
    const results: { planet: number; rocket: number }[] = [];

    for (let i = 0; i < N; i++) {
      const actor = createActor(twoStepTrialMachine, { input: defaultTrialInput });
      actor.start();

      // Wait for fixation
      await new Promise(r => setTimeout(r, 600));
      const rocket = (i % 2) as 0 | 1;
      actor.send({ type: 'CHOOSE', option: rocket });

      const ctx = actor.getSnapshot().context;
      results.push({ planet: ctx.planet!, rocket });
      actor.stop();
    }

    // For rocket i, common planet is i. Count how often planet === rocket.
    const commonCount = results.filter(r => r.planet === r.rocket).length;
    const commonRate = commonCount / results.length;

    // Should be approximately 0.7 (wide tolerance for N=50)
    expect(commonRate).toBeGreaterThan(0.4);
    expect(commonRate).toBeLessThan(0.95);
  }, 60000);
});

// =============================================================================
// Experiment Machine
// =============================================================================

describe('twoStepExperimentMachine', () => {
  it('starts in instructions state', () => {
    const actor = createActor(twoStepExperimentMachine);
    actor.start();
    expect(actor.getSnapshot().value).toBe('instructions');

    const ctx = actor.getSnapshot().context;
    expect(ctx.currentIndex).toBe(0);
    expect(ctx.responses).toHaveLength(0);
    expect(ctx.totalReward).toBe(0);
    expect(ctx.rewardProbs).toEqual([[0.5, 0.5], [0.5, 0.5]]);
    actor.stop();
  });

  it('START transitions to running', () => {
    const actor = createActor(twoStepExperimentMachine);
    actor.start();

    actor.send({ type: 'START' });
    const state = actor.getSnapshot().value;
    expect(state).toEqual({ running: 'active' });
    actor.stop();
  });

  it('invokes a trial actor on START', () => {
    const actor = createActor(twoStepExperimentMachine);
    actor.start();
    actor.send({ type: 'START' });

    const snap = actor.getSnapshot();
    expect(snap.children?.currentTrial).toBeDefined();
    actor.stop();
  });

  it('has correct transition probability matrix', () => {
    const actor = createActor(twoStepExperimentMachine);
    actor.start();

    const ctx = actor.getSnapshot().context;
    expect(ctx.transitionProbs[0][0]).toBeCloseTo(0.7);
    expect(ctx.transitionProbs[0][1]).toBeCloseTo(0.3);
    expect(ctx.transitionProbs[1][0]).toBeCloseTo(0.3);
    expect(ctx.transitionProbs[1][1]).toBeCloseTo(0.7);
    actor.stop();
  });

  it('completes a full trial and advances index', async () => {
    const actor = createActor(twoStepExperimentMachine);
    actor.start();
    actor.send({ type: 'START' });

    // Get the trial actor
    let snap = actor.getSnapshot();
    const trialRef = snap.children?.currentTrial;
    expect(trialRef).toBeDefined();

    // fixation -> stage1
    await new Promise(r => setTimeout(r, 600));
    (trialRef as any).send({ type: 'CHOOSE', option: 0 });

    // transition -> stage2
    await new Promise(r => setTimeout(r, 400));
    const trialSnap = (trialRef as any).getSnapshot();
    const stage2Ref = trialSnap.children?.stage2;
    expect(stage2Ref).toBeDefined();
    (stage2Ref as any).send({ type: 'CHOOSE', option: 0 });

    // feedback -> iti -> done, then experiment advances
    await new Promise(r => setTimeout(r, 1700));

    snap = actor.getSnapshot();
    const ctx = snap.context;
    expect(ctx.currentIndex).toBe(1);
    expect(ctx.responses).toHaveLength(1);

    const response = ctx.responses[0] as TrialOutput;
    expect(response.trialIndex).toBe(0);
    expect(response.stage1Choice).toBe(0);
    expect(response.stage2Choice).toBe(0);
    expect([0, 1]).toContain(response.planet);
    expect(['common', 'rare']).toContain(response.transitionType);
    expect([0, 1]).toContain(response.reward);
    expect(response.stage1RT).toBeTypeOf('number');
    expect(response.stage2RT).toBeTypeOf('number');

    actor.stop();
  }, 10000);

  it('reward probabilities drift after each trial', async () => {
    const actor = createActor(twoStepExperimentMachine);
    actor.start();

    const initialProbs = JSON.parse(JSON.stringify(actor.getSnapshot().context.rewardProbs));

    actor.send({ type: 'START' });

    // Complete one trial
    let snap = actor.getSnapshot();
    const trialRef = snap.children?.currentTrial;

    await new Promise(r => setTimeout(r, 600));
    (trialRef as any).send({ type: 'CHOOSE', option: 0 });

    await new Promise(r => setTimeout(r, 400));
    const trialSnap = (trialRef as any).getSnapshot();
    const stage2Ref = trialSnap.children?.stage2;
    (stage2Ref as any).send({ type: 'CHOOSE', option: 0 });

    await new Promise(r => setTimeout(r, 1700));

    // After trial, rewardProbs should have drifted
    const newProbs = actor.getSnapshot().context.rewardProbs;

    // At least one value should differ (extremely unlikely all 4 drift to exactly 0)
    const anyDifferent = newProbs.some((row: number[], p: number) =>
      row.some((val: number, o: number) => Math.abs(val - initialProbs[p][o]) > 1e-10)
    );
    expect(anyDifferent).toBe(true);

    actor.stop();
  }, 10000);

  it('output has all expected fields', async () => {
    const actor = createActor(twoStepExperimentMachine);
    actor.start();
    actor.send({ type: 'START' });

    // Complete one trial
    const trialRef = actor.getSnapshot().children?.currentTrial;
    await new Promise(r => setTimeout(r, 600));
    (trialRef as any).send({ type: 'CHOOSE', option: 1 });

    await new Promise(r => setTimeout(r, 400));
    const trialSnap = (trialRef as any).getSnapshot();
    const stage2Ref = trialSnap.children?.stage2;
    (stage2Ref as any).send({ type: 'CHOOSE', option: 0 });

    await new Promise(r => setTimeout(r, 1700));

    const response = actor.getSnapshot().context.responses[0] as TrialOutput;

    // Verify all expected fields exist
    expect(response).toHaveProperty('trialIndex');
    expect(response).toHaveProperty('stage1Choice');
    expect(response).toHaveProperty('stage2Choice');
    expect(response).toHaveProperty('planet');
    expect(response).toHaveProperty('transitionType');
    expect(response).toHaveProperty('reward');
    expect(response).toHaveProperty('stage1RT');
    expect(response).toHaveProperty('stage2RT');

    actor.stop();
  }, 10000);
});
