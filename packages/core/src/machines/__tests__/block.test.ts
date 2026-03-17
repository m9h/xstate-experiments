import { describe, it, expect } from 'vitest';
import { createActor, setup, assign } from 'xstate';
import { createBlockMachine } from '../block';

// Simple mock trial that completes immediately when sent COMPLETE
const mockTrialMachine = setup({
  types: {} as {
    context: { trialIndex: number };
    input: { trialIndex: number };
    events: { type: 'COMPLETE' };
    output: { trialIndex: number; correct: boolean };
  },
}).createMachine({
  id: 'mockTrial',
  initial: 'running',
  context: ({ input }) => ({ trialIndex: input.trialIndex }),
  states: {
    running: {
      on: {
        COMPLETE: 'done',
      },
    },
    done: { type: 'final' },
  },
  output: ({ context }) => ({ trialIndex: context.trialIndex, correct: true }),
});

describe('createBlockMachine', () => {
  it('should start in runningTrials by default (no block instructions)', () => {
    const machine = createBlockMachine({
      id: 'testBlock',
      trials: [{ trialIndex: 0 }, { trialIndex: 1 }],
      trialMachine: mockTrialMachine,
    });

    const actor = createActor(machine);
    actor.start();
    const snap = actor.getSnapshot();
    expect(snap.matches({ runningTrials: 'active' })).toBe(true);
    actor.stop();
  });

  it('should start in blockInstructions when showBlockInstructions=true', () => {
    const machine = createBlockMachine({
      id: 'testBlock',
      trials: [{ trialIndex: 0 }],
      trialMachine: mockTrialMachine,
      showBlockInstructions: true,
    });

    const actor = createActor(machine);
    actor.start();
    expect(actor.getSnapshot().matches('blockInstructions')).toBe(true);

    actor.send({ type: 'START' });
    expect(actor.getSnapshot().matches({ runningTrials: 'active' })).toBe(true);
    actor.stop();
  });

  it('should initialize context correctly', () => {
    const trials = [{ trialIndex: 0 }, { trialIndex: 1 }, { trialIndex: 2 }];
    const machine = createBlockMachine({
      id: 'testBlock',
      trials,
      trialMachine: mockTrialMachine,
    });

    const actor = createActor(machine);
    actor.start();
    const ctx = actor.getSnapshot().context;

    expect(ctx.trials).toEqual(trials);
    expect(ctx.currentIndex).toBe(0);
    expect(ctx.results).toEqual([]);
    expect(ctx.correctCount).toBe(0);
    expect(ctx.totalTrials).toBe(3);
    actor.stop();
  });

  it('should track correct count as trials complete', () => {
    const machine = createBlockMachine({
      id: 'testBlock',
      trials: [{ trialIndex: 0 }, { trialIndex: 1 }],
      trialMachine: mockTrialMachine,
    });

    const actor = createActor(machine);
    actor.start();

    // Complete first trial
    const trialRef = actor.getSnapshot().children.currentTrial;
    expect(trialRef).toBeDefined();
    (trialRef as any).send({ type: 'COMPLETE' });

    // After first trial, correctCount should increment (mock returns correct: true)
    const ctx = actor.getSnapshot().context;
    expect(ctx.correctCount).toBe(1);
    expect(ctx.currentIndex).toBe(1);
    expect(ctx.results).toHaveLength(1);
    actor.stop();
  });

  it('should include extraContext in initial context', () => {
    const machine = createBlockMachine({
      id: 'testBlock',
      trials: [{ trialIndex: 0 }],
      trialMachine: mockTrialMachine,
      extraContext: { difficulty: 'hard', condition: 'A' },
    });

    const actor = createActor(machine);
    actor.start();
    const ctx = actor.getSnapshot().context;
    expect(ctx.difficulty).toBe('hard');
    expect(ctx.condition).toBe('A');
    actor.stop();
  });
});
