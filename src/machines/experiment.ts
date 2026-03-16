import { setup, assign, type AnyActorLogic, type AnyEventObject } from 'xstate';

export interface ExperimentConfig {
  /** Unique experiment ID */
  id: string;
  /** Array of task/trial definitions (passed to trial actors as input) */
  tasks: unknown[];
  /** The trial machine to invoke for each task */
  trialMachine: AnyActorLogic;
  /** Optional: custom context fields */
  extraContext?: Record<string, unknown>;
  /** Optional: show instructions screen (default true) */
  showInstructions?: boolean;
  /** Optional: show results screen (default true) */
  showResults?: boolean;
}

export interface ExperimentContext {
  tasks: unknown[];
  currentIndex: number;
  responses: unknown[];
  startTime: number | null;
  [key: string]: unknown;
}

/**
 * Creates a generic experiment machine that orchestrates a sequence of trials.
 *
 * Statechart:
 *   instructions → runningTrials (active / checkNext) → results
 *
 * Each trial is an invoked actor that receives { task, taskIndex } as input
 * and emits structured output when it reaches its final state.
 */
export function createExperimentMachine(config: ExperimentConfig) {
  const {
    id,
    tasks,
    trialMachine,
    extraContext = {},
    showInstructions = true,
  } = config;

  return setup({
    types: {} as {
      context: ExperimentContext;
      events:
        | { type: 'START' }
        | AnyEventObject;
    },
    actors: {
      trialMachine: trialMachine,
    },
    actions: {
      collectResult: assign({
        responses: ({ context, event }) => {
          const output = (event as any).output;
          return [...context.responses, output];
        },
        currentIndex: ({ context }) => context.currentIndex + 1,
      }),
      recordStartTime: assign({
        startTime: () => performance.now(),
      }),
    },
    guards: {
      hasMoreTasks: ({ context }) => context.currentIndex < context.tasks.length,
    },
  }).createMachine({
    id,
    initial: showInstructions ? 'instructions' : 'runningTrials',
    context: {
      tasks,
      currentIndex: 0,
      responses: [],
      startTime: null,
      ...extraContext,
    },
    states: {
      ...(showInstructions
        ? {
            instructions: {
              on: {
                START: {
                  target: 'runningTrials',
                  actions: 'recordStartTime',
                },
              },
            },
          }
        : {}),
      runningTrials: {
        entry: showInstructions ? [] : ['recordStartTime'],
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'currentTrial',
              src: 'trialMachine',
              input: ({ context }: { context: ExperimentContext }) => ({
                task: context.tasks[context.currentIndex],
                taskIndex: context.currentIndex,
              }),
              onDone: {
                target: 'checkNext',
                actions: 'collectResult',
              },
            },
          },
          checkNext: {
            always: [
              { target: 'active', guard: 'hasMoreTasks' },
              { target: `#${id}.results` },
            ],
          },
        },
      },
      results: { type: 'final' as const },
    },
  });
}
