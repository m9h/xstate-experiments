import { setup, assign } from 'xstate';

export interface KeyboardTrialInput {
  stimulus: string;
  validKeys: string[];
  correctKey: string;
  fixationDuration?: number;
  feedbackDuration?: number;
}

export interface KeyboardTrialContext {
  stimulus: string;
  validKeys: string[];
  correctKey: string;
  fixationDuration: number;
  feedbackDuration: number;
  response: string | null;
  rt: number | null;
  correct: boolean | null;
  stimulusOnsetTime: number | null;
}

export interface KeyboardTrialOutput {
  response: string;
  rt: number;
  correct: boolean;
}

/**
 * Generic keyboard response trial machine.
 *
 * States: fixation → stimulus (KEYPRESS with validKey guard) → feedback → done
 *
 * Input: { stimulus, validKeys, correctKey, fixationDuration?, feedbackDuration? }
 * Output: { response, rt, correct }
 */
export const keyboardTrialMachine = setup({
  types: {} as {
    context: KeyboardTrialContext;
    input: KeyboardTrialInput;
    events: { type: 'KEYPRESS'; key: string; timestamp: number };
    output: KeyboardTrialOutput;
  },
  actions: {
    recordStimulusOnset: assign({
      stimulusOnsetTime: () => performance.now(),
    }),
    recordResponse: assign(({ context, event }) => ({
      response: event.key,
      rt: performance.now() - (context.stimulusOnsetTime ?? performance.now()),
      correct: event.key === context.correctKey,
    })),
  },
  guards: {
    validKey: ({ context, event }) =>
      context.validKeys.includes(event.key),
  },
  delays: {
    fixationDelay: ({ context }) => context.fixationDuration,
    feedbackDelay: ({ context }) => context.feedbackDuration,
  },
}).createMachine({
  id: 'keyboardTrial',
  initial: 'fixation',
  context: ({ input }) => ({
    stimulus: input.stimulus,
    validKeys: input.validKeys,
    correctKey: input.correctKey,
    fixationDuration: input.fixationDuration ?? 500,
    feedbackDuration: input.feedbackDuration ?? 1000,
    response: null,
    rt: null,
    correct: null,
    stimulusOnsetTime: null,
  }),
  states: {
    fixation: {
      after: { fixationDelay: 'stimulus' },
    },
    stimulus: {
      entry: 'recordStimulusOnset',
      on: {
        KEYPRESS: {
          target: 'feedback',
          guard: 'validKey',
          actions: 'recordResponse',
        },
      },
    },
    feedback: {
      after: { feedbackDelay: 'done' },
    },
    done: { type: 'final' },
  },
  output: ({ context }) => ({
    response: context.response!,
    rt: context.rt!,
    correct: context.correct!,
  }),
});
