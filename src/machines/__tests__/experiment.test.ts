import { describe, it, expect } from 'vitest';
import { createActor, setup, assign } from 'xstate';
import { createExperimentMachine } from '../experiment';

// A minimal mock trial machine that immediately completes with known output
const mockTrialMachine = setup({
  types: {} as {
    input: { task: unknown; taskIndex: number };
    output: { taskIndex: number; result: string };
  },
}).createMachine({
  id: 'mockTrial',
  initial: 'running',
  context: ({ input }) => ({
    taskIndex: input.taskIndex,
    task: input.task,
  }),
  states: {
    running: {
      on: {
        COMPLETE: 'done',
      },
    },
    done: { type: 'final' },
  },
  output: ({ context }) => ({
    taskIndex: context.taskIndex,
    result: `completed-${context.taskIndex}`,
  }),
});

describe('createExperimentMachine', () => {
  it('starts in instructions state by default', () => {
    const machine = createExperimentMachine({
      id: 'test-exp',
      tasks: ['a', 'b'],
      trialMachine: mockTrialMachine,
    });

    const actor = createActor(machine);
    actor.start();

    expect(actor.getSnapshot().value).toBe('instructions');
    actor.stop();
  });

  it('skips instructions when showInstructions=false', () => {
    const machine = createExperimentMachine({
      id: 'test-exp',
      tasks: ['a'],
      trialMachine: mockTrialMachine,
      showInstructions: false,
    });

    const actor = createActor(machine);
    actor.start();

    const snap = actor.getSnapshot();
    expect(snap.matches('runningTrials')).toBe(true);
    actor.stop();
  });

  it('transitions to runningTrials on START', () => {
    const machine = createExperimentMachine({
      id: 'test-exp',
      tasks: ['a'],
      trialMachine: mockTrialMachine,
    });

    const actor = createActor(machine);
    actor.start();
    actor.send({ type: 'START' });

    expect(actor.getSnapshot().matches('runningTrials')).toBe(true);
    expect(actor.getSnapshot().context.startTime).toBeTypeOf('number');
    actor.stop();
  });

  it('records startTime on START', () => {
    const machine = createExperimentMachine({
      id: 'test-exp',
      tasks: ['a'],
      trialMachine: mockTrialMachine,
    });

    const actor = createActor(machine);
    actor.start();

    expect(actor.getSnapshot().context.startTime).toBeNull();
    actor.send({ type: 'START' });
    expect(actor.getSnapshot().context.startTime).toBeTypeOf('number');
    actor.stop();
  });

  it('initializes context with tasks and defaults', () => {
    const tasks = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const machine = createExperimentMachine({
      id: 'test-exp',
      tasks,
      trialMachine: mockTrialMachine,
    });

    const actor = createActor(machine);
    actor.start();

    const ctx = actor.getSnapshot().context;
    expect(ctx.tasks).toEqual(tasks);
    expect(ctx.currentIndex).toBe(0);
    expect(ctx.responses).toEqual([]);
    actor.stop();
  });

  it('includes extraContext in initial context', () => {
    const machine = createExperimentMachine({
      id: 'test-exp',
      tasks: [],
      trialMachine: mockTrialMachine,
      extraContext: { participantId: 'P001', condition: 'A' },
    });

    const actor = createActor(machine);
    actor.start();

    const ctx = actor.getSnapshot().context;
    expect(ctx.participantId).toBe('P001');
    expect(ctx.condition).toBe('A');
    actor.stop();
  });
});
