import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { createTrialMachine } from '../trial';

describe('createTrialMachine', () => {
  it('should start in fixation state', () => {
    const machine = createTrialMachine();
    const actor = createActor(machine, { input: { trialIndex: 0 } });
    actor.start();
    expect(actor.getSnapshot().matches('fixation')).toBe(true);
    actor.stop();
  });

  it('should transition fixation → stimulus after delay', async () => {
    const machine = createTrialMachine({ fixationDuration: 50 });
    const actor = createActor(machine, { input: { trialIndex: 0 } });
    actor.start();
    expect(actor.getSnapshot().matches('fixation')).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(actor.getSnapshot().matches('stimulus')).toBe(true);
    actor.stop();
  });

  it('should record response on RESPOND event', async () => {
    const machine = createTrialMachine({ fixationDuration: 10 });
    const actor = createActor(machine, { input: { trialIndex: 0 } });
    actor.start();

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(actor.getSnapshot().matches('stimulus')).toBe(true);

    actor.send({ type: 'RESPOND', value: 'left' });

    const ctx = actor.getSnapshot().context;
    expect(ctx.response).toBe('left');
    expect(ctx.rt).toBeGreaterThan(0);
  });

  it('should transition to feedback after response (default showFeedback=true)', async () => {
    const machine = createTrialMachine({ fixationDuration: 10, feedbackDuration: 50 });
    const actor = createActor(machine, { input: { trialIndex: 0 } });
    actor.start();

    await new Promise(resolve => setTimeout(resolve, 50));
    actor.send({ type: 'RESPOND', value: 'a' });
    expect(actor.getSnapshot().matches('feedback')).toBe(true);

    actor.stop();
  });

  it('should skip feedback when showFeedback=false', async () => {
    const machine = createTrialMachine({ fixationDuration: 10, showFeedback: false });
    const actor = createActor(machine, { input: { trialIndex: 0 } });

    let output: any = null;
    actor.subscribe({ complete: () => { output = actor.getSnapshot().output; } });
    actor.start();

    await new Promise(resolve => setTimeout(resolve, 50));
    actor.send({ type: 'RESPOND', value: 'x' });

    // Should go directly to done
    expect(actor.getSnapshot().matches('done')).toBe(true);
    expect(output).toBeDefined();
    expect(output.response).toBe('x');
  });

  it('should produce correct output', async () => {
    const machine = createTrialMachine({
      fixationDuration: 10,
      feedbackDuration: 10,
    });
    const actor = createActor(machine, { input: { trialIndex: 5 } });

    let output: any = null;
    actor.subscribe({ complete: () => { output = actor.getSnapshot().output; } });
    actor.start();

    await new Promise(resolve => setTimeout(resolve, 50));
    actor.send({ type: 'RESPOND', value: 'right' });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(output).toBeDefined();
    expect(output.trialIndex).toBe(5);
    expect(output.response).toBe('right');
    expect(output.rt).toBeGreaterThan(0);
  });

  it('should initialize context from input', () => {
    const machine = createTrialMachine({ fixationDuration: 200, feedbackDuration: 500 });
    const actor = createActor(machine, { input: { trialIndex: 3 } });
    actor.start();

    const ctx = actor.getSnapshot().context;
    expect(ctx.trialIndex).toBe(3);
    expect(ctx.fixationDuration).toBe(200);
    expect(ctx.feedbackDuration).toBe(500);
    expect(ctx.response).toBeNull();
    expect(ctx.rt).toBeNull();
    expect(ctx.correct).toBeNull();

    actor.stop();
  });
});
