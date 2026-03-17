import { setup, assign, type AnyActorLogic } from 'xstate';

export interface BlockConfig {
  /** Unique block ID */
  id: string;
  /** Array of trial definitions for this block */
  trials: unknown[];
  /** The trial machine to invoke for each trial */
  trialMachine: AnyActorLogic;
  /** Optional: show block instructions (default false) */
  showBlockInstructions?: boolean;
  /** Optional: show block feedback summary (default false) */
  showBlockFeedback?: boolean;
  /** Optional: custom context fields */
  extraContext?: Record<string, unknown>;
}

export interface BlockContext {
  trials: unknown[];
  currentIndex: number;
  results: unknown[];
  startTime: number | null;
  correctCount: number;
  totalTrials: number;
  [key: string]: unknown;
}

/**
 * Creates a block machine that sequences a set of trials.
 *
 * Statechart:
 *   blockInstructions? → runningTrials (active / checkNext) → blockFeedback? → done
 *
 * Each trial is invoked as a child actor. Block tracks aggregate metrics
 * (correctCount, totalTrials) across trials.
 */
export function createBlockMachine(config: BlockConfig) {
  const {
    id,
    trials,
    trialMachine,
    showBlockInstructions = false,
    showBlockFeedback = false,
    extraContext = {},
  } = config;

  const initialState = showBlockInstructions ? 'blockInstructions' : 'runningTrials';

  return setup({
    types: {} as {
      context: BlockContext;
      events:
        | { type: 'START' }
        | { type: 'CONTINUE' };
    },
    actors: {
      trialMachine,
    },
    actions: {
      collectResult: assign({
        results: ({ context, event }) => {
          const output = (event as any).output;
          return [...context.results, output];
        },
        currentIndex: ({ context }) => context.currentIndex + 1,
        correctCount: ({ context, event }) => {
          const output = (event as any).output;
          const wasCorrect = output?.correct === true || output?.reward === 1;
          return context.correctCount + (wasCorrect ? 1 : 0);
        },
      }),
      recordStartTime: assign({
        startTime: () => performance.now(),
      }),
    },
    guards: {
      hasMoreTrials: ({ context }) => context.currentIndex < context.trials.length,
    },
  }).createMachine({
    id,
    initial: initialState,
    context: {
      trials,
      currentIndex: 0,
      results: [],
      startTime: null,
      correctCount: 0,
      totalTrials: trials.length,
      ...extraContext,
    },
    states: {
      ...(showBlockInstructions
        ? {
            blockInstructions: {
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
        entry: showBlockInstructions ? [] : ['recordStartTime'],
        initial: 'active',
        states: {
          active: {
            invoke: {
              id: 'currentTrial',
              src: 'trialMachine',
              input: ({ context }: { context: BlockContext }) => ({
                ...(context.trials[context.currentIndex] as Record<string, unknown>),
                trialIndex: context.currentIndex,
              }),
              onDone: {
                target: 'checkNext',
                actions: 'collectResult',
              },
            },
          },
          checkNext: {
            always: [
              { target: 'active', guard: 'hasMoreTrials' },
              ...(showBlockFeedback
                ? [{ target: `#${id}.blockFeedback` as const }]
                : [{ target: `#${id}.done` as const }]),
            ],
          },
        },
      },
      ...(showBlockFeedback
        ? {
            blockFeedback: {
              on: {
                CONTINUE: 'done',
              },
            },
          }
        : {}),
      done: { type: 'final' as const },
    },
    output: ({ context }) => ({
      results: context.results,
      correctCount: context.correctCount,
      totalTrials: context.totalTrials,
      duration: context.startTime ? performance.now() - context.startTime : 0,
    }),
  });
}
