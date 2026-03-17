import { setup, assign, type AnyEventObject } from 'xstate';

// ── Config & types ──────────────────────────────────────────────────

export interface HtmlKeyboardTrialConfig {
  /** HTML string rendered as the stimulus */
  stimulus: string;
  /** Keyboard keys accepted as valid responses */
  choices: string[];
  /** If provided, the key that counts as "correct" */
  correctResponse?: string;
  /** ms to display the stimulus before accepting responses. null = no limit. Default 0. */
  stimulusDuration?: number | null;
  /** ms for the entire trial. null = no limit. Default null. */
  trialDuration?: number | null;
  /** Whether the response ends the trial immediately. Default true. */
  responsePendsOnEnd?: boolean;
  /** Duration of the fixation cross in ms. Default 500. */
  fixationDuration?: number;
  /** Duration of the feedback screen in ms. 0 = skip feedback. Default 1000. */
  feedbackDuration?: number;
}

export interface HtmlKeyboardTrialContext {
  stimulus: string;
  choices: string[];
  correctResponse: string | null;
  stimulusDuration: number | null;
  trialDuration: number | null;
  responsePendsOnEnd: boolean;
  fixationDuration: number;
  feedbackDuration: number;
  response: string | null;
  rt: number | null;
  correct: boolean | null;
  stimulusOnsetTime: number | null;
  trialStartTime: number | null;
}

export interface HtmlKeyboardTrialOutput {
  stimulus: string;
  response: string | null;
  rt: number | null;
  correct: boolean | null;
}

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Creates an HTML-keyboard trial machine.
 *
 * Statechart:
 *   fixation -> stimulus -> response -> feedback -> done
 *
 * During `stimulus`, a KEYPRESS event with a valid key transitions to
 * `response` (or directly to `feedback` when responsePendsOnEnd is true).
 * Optional timed limits on stimulus display and total trial duration
 * are handled via delayed transitions.
 */
export function createHtmlKeyboardTrialMachine(config: HtmlKeyboardTrialConfig) {
  const {
    stimulus,
    choices,
    correctResponse = null,
    stimulusDuration = null,
    trialDuration = null,
    responsePendsOnEnd = true,
    fixationDuration = 500,
    feedbackDuration = 1000,
  } = config;

  const hasFeedback = feedbackDuration > 0 && correctResponse !== null;

  return setup({
    types: {} as {
      context: HtmlKeyboardTrialContext;
      events:
        | { type: 'KEYPRESS'; key: string; timestamp: number }
        | AnyEventObject;
      output: HtmlKeyboardTrialOutput;
    },
    actions: {
      recordTrialStart: assign({
        trialStartTime: () => performance.now(),
      }),
      recordStimulusOnset: assign({
        stimulusOnsetTime: () => performance.now(),
      }),
      recordResponse: assign(({ context, event }) => {
        const e = event as { type: 'KEYPRESS'; key: string; timestamp: number };
        const rt = context.stimulusOnsetTime !== null
          ? e.timestamp - context.stimulusOnsetTime
          : null;
        const correct = context.correctResponse !== null
          ? e.key === context.correctResponse
          : null;
        return { response: e.key, rt, correct };
      }),
    },
    guards: {
      isValidKey: ({ context, event }) => {
        const e = event as { type: 'KEYPRESS'; key: string };
        return context.choices.length === 0 || context.choices.includes(e.key);
      },
      hasFeedbackPhase: () => hasFeedback,
      noFeedbackPhase: () => !hasFeedback,
    },
    delays: {
      fixationDelay: () => fixationDuration,
      stimulusTimeout: () => stimulusDuration ?? 0,
      trialTimeout: () => trialDuration ?? 0,
      feedbackDelay: () => feedbackDuration,
    },
  }).createMachine({
    id: 'htmlKeyboardTrial',
    initial: 'fixation',
    context: {
      stimulus,
      choices,
      correctResponse,
      stimulusDuration,
      trialDuration,
      responsePendsOnEnd,
      fixationDuration,
      feedbackDuration,
      response: null,
      rt: null,
      correct: null,
      stimulusOnsetTime: null,
      trialStartTime: null,
    },
    states: {
      fixation: {
        entry: 'recordTrialStart',
        after: { fixationDelay: 'stimulus' },
      },

      stimulus: {
        entry: 'recordStimulusOnset',
        on: {
          KEYPRESS: {
            guard: 'isValidKey',
            actions: 'recordResponse',
            target: 'response',
          },
        },
        after: {
          // If stimulus has a finite duration and no response arrives, move on
          ...(stimulusDuration !== null
            ? { stimulusTimeout: 'response' }
            : {}),
        },
      },

      response: {
        // If responsePendsOnEnd, transition immediately to feedback/done.
        // Otherwise wait for a trial-level timeout or fall through.
        always: [
          ...(responsePendsOnEnd
            ? [
                { target: 'feedback' as const, guard: 'hasFeedbackPhase' as const },
                { target: 'done' as const, guard: 'noFeedbackPhase' as const },
              ]
            : []),
        ],
        // When !responsePendsOnEnd, a trialDuration timeout drives progress
        after: {
          ...(trialDuration !== null && !responsePendsOnEnd
            ? { trialTimeout: hasFeedback ? ('feedback' as const) : ('done' as const) }
            : {}),
        },
      },

      feedback: {
        after: { feedbackDelay: 'done' },
      },

      done: { type: 'final' as const },
    },

    output: ({ context }) => ({
      stimulus: context.stimulus,
      response: context.response,
      rt: context.rt,
      correct: context.correct,
    }),
  });
}
