import { setup, assign } from 'xstate';

export interface TrialConfig {
  /** Fixed cross duration in ms (default 500) */
  fixationDuration?: number;
  /** Stimulus display duration in ms, or null for indefinite (default null) */
  stimulusDuration?: number | null;
  /** Response timeout in ms, or null for no timeout (default null) */
  responseTimeout?: number | null;
  /** Feedback display duration in ms (default 1000) */
  feedbackDuration?: number;
  /** Whether to show feedback (default true) */
  showFeedback?: boolean;
}

export interface BaseTrialInput {
  trialIndex: number;
  [key: string]: unknown;
}

export interface BaseTrialContext {
  trialIndex: number;
  fixationDuration: number;
  stimulusDuration: number | null;
  responseTimeout: number | null;
  feedbackDuration: number;
  showFeedback: boolean;
  response: unknown;
  rt: number | null;
  correct: boolean | null;
  stimulusOnsetTime: number | null;
  fixationOnsetTime: number | null;
}

export interface BaseTrialOutput {
  trialIndex: number;
  response: unknown;
  rt: number | null;
  correct: boolean | null;
}

/**
 * Creates a base trial machine with the standard phase sequence:
 *   fixation → stimulus → response → feedback? → done
 *
 * This is the composable building block. Specific trial types extend
 * this pattern by providing custom events, guards, and actions.
 *
 * Input: { trialIndex, ...custom }
 * Output: { trialIndex, response, rt, correct }
 */
export function createTrialMachine(config: TrialConfig = {}) {
  const {
    fixationDuration = 500,
    stimulusDuration = null,
    feedbackDuration = 1000,
    responseTimeout = null,
    showFeedback = true,
  } = config;

  return setup({
    types: {} as {
      context: BaseTrialContext;
      input: BaseTrialInput;
      events:
        | { type: 'RESPOND'; value: unknown }
        | { type: 'TIMEOUT' };
      output: BaseTrialOutput;
    },
    actions: {
      recordFixationOnset: assign({
        fixationOnsetTime: () => performance.now(),
      }),
      recordStimulusOnset: assign({
        stimulusOnsetTime: () => performance.now(),
      }),
      recordResponse: assign(({ context, event }) => {
        const e = event as { type: 'RESPOND'; value: unknown };
        return {
          response: e.value,
          rt: performance.now() - (context.stimulusOnsetTime ?? performance.now()),
        };
      }),
      recordTimeout: assign({
        response: () => null as unknown,
        rt: () => null as number | null,
        correct: () => null as boolean | null,
      }),
    },
    delays: {
      fixationDelay: () => fixationDuration,
      stimulusDelay: () => stimulusDuration ?? 0,
      feedbackDelay: () => feedbackDuration,
      responseTimeoutDelay: () => responseTimeout ?? 0,
    },
    guards: {
      hasStimulusDuration: () => stimulusDuration !== null,
      hasResponseTimeout: () => responseTimeout !== null,
    },
  }).createMachine({
    id: 'trial',
    initial: 'fixation',
    context: ({ input }) => ({
      trialIndex: input.trialIndex,
      fixationDuration,
      stimulusDuration,
      responseTimeout,
      feedbackDuration,
      showFeedback,
      response: null,
      rt: null,
      correct: null,
      stimulusOnsetTime: null,
      fixationOnsetTime: null,
    }),
    states: {
      fixation: {
        entry: 'recordFixationOnset',
        after: { fixationDelay: 'stimulus' },
      },
      stimulus: {
        entry: 'recordStimulusOnset',
        on: {
          RESPOND: {
            target: showFeedback ? 'feedback' : 'done',
            actions: 'recordResponse',
          },
        },
        ...(stimulusDuration !== null
          ? {
              after: {
                stimulusDelay: showFeedback ? 'feedback' : 'done',
              },
            }
          : {}),
        ...(responseTimeout !== null
          ? {
              after: {
                responseTimeoutDelay: showFeedback ? 'feedback' : 'done',
              },
            }
          : {}),
      },
      ...(showFeedback
        ? {
            feedback: {
              after: { feedbackDelay: 'done' },
            },
          }
        : {}),
      done: { type: 'final' as const },
    },
    output: ({ context }) => ({
      trialIndex: context.trialIndex,
      response: context.response,
      rt: context.rt,
      correct: context.correct,
    }),
  });
}
