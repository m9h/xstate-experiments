import { setup, assign, type AnyEventObject } from 'xstate';

// ── Config & types ──────────────────────────────────────────────────

export interface SurveyQuestion {
  /** The question text / prompt shown to the participant */
  prompt: string;
  /** Input type for this question */
  type: 'text' | 'likert' | 'multi-choice';
  /** Available options (required for likert and multi-choice) */
  options?: string[];
  /** Whether the question must be answered before submission. Default true. */
  required?: boolean;
}

export interface SurveyTrialConfig {
  /** Array of questions to present */
  questions: SurveyQuestion[];
  /** Whether to show all questions at once or one at a time. Default 'all'. */
  presentationMode?: 'all' | 'sequential';
  /** Button text for the submit button. Default 'Continue'. */
  submitLabel?: string;
}

export interface SurveyAnswer {
  questionIndex: number;
  prompt: string;
  type: SurveyQuestion['type'];
  value: string | null;
}

export interface SurveyTrialContext {
  questions: SurveyQuestion[];
  presentationMode: 'all' | 'sequential';
  submitLabel: string;
  /** Current answers keyed by question index */
  answers: Record<number, string>;
  /** Which question is currently shown (sequential mode) */
  currentQuestionIndex: number;
  /** Validation errors keyed by question index */
  validationErrors: Record<number, string>;
  /** Start time for RT measurement */
  startTime: number | null;
  /** Total time spent on the survey */
  rt: number | null;
}

export interface SurveyTrialOutput {
  answers: SurveyAnswer[];
  rt: number | null;
}

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Creates a survey / questionnaire trial machine.
 *
 * Statechart:
 *   presenting -> responding -> validating -> done
 *                     ^             |
 *                     +-- (errors) -+
 *
 * The machine accepts ANSWER events to record individual question
 * responses, then validates all required questions on SUBMIT.
 * If validation fails, it returns to `responding` with error context.
 */
export function createSurveyTrialMachine(config: SurveyTrialConfig) {
  const {
    questions,
    presentationMode = 'all',
    submitLabel = 'Continue',
  } = config;

  return setup({
    types: {} as {
      context: SurveyTrialContext;
      events:
        | { type: 'ANSWER'; questionIndex: number; value: string }
        | { type: 'SUBMIT' }
        | { type: 'NEXT_QUESTION' }
        | { type: 'PREV_QUESTION' }
        | AnyEventObject;
      output: SurveyTrialOutput;
    },
    actions: {
      recordStartTime: assign({
        startTime: () => performance.now(),
      }),
      recordAnswer: assign(({ context, event }) => {
        const e = event as { type: 'ANSWER'; questionIndex: number; value: string };
        return {
          answers: { ...context.answers, [e.questionIndex]: e.value },
          // Clear any validation error for this question when it gets answered
          validationErrors: (() => {
            const errors = { ...context.validationErrors };
            delete errors[e.questionIndex];
            return errors;
          })(),
        };
      }),
      advanceQuestion: assign({
        currentQuestionIndex: ({ context }) =>
          Math.min(context.currentQuestionIndex + 1, context.questions.length - 1),
      }),
      retreatQuestion: assign({
        currentQuestionIndex: ({ context }) =>
          Math.max(context.currentQuestionIndex - 1, 0),
      }),
      validateResponses: assign(({ context }) => {
        const errors: Record<number, string> = {};
        context.questions.forEach((q, i) => {
          const isRequired = q.required !== false; // default true
          const answer = context.answers[i];
          if (isRequired && (answer === undefined || answer.trim() === '')) {
            errors[i] = `Question ${i + 1} is required`;
          }
        });
        return { validationErrors: errors };
      }),
      recordCompletionTime: assign({
        rt: ({ context }) =>
          context.startTime !== null ? performance.now() - context.startTime : null,
      }),
    },
    guards: {
      allValid: ({ context }) => {
        // Check validation inline (after validateResponses has run,
        // this guard fires on the same transition in validating)
        return context.questions.every((q, i) => {
          const isRequired = q.required !== false;
          const answer = context.answers[i];
          return !isRequired || (answer !== undefined && answer.trim() !== '');
        });
      },
      hasValidationErrors: ({ context }) => {
        return context.questions.some((q, i) => {
          const isRequired = q.required !== false;
          const answer = context.answers[i];
          return isRequired && (answer === undefined || answer.trim() === '');
        });
      },
    },
  }).createMachine({
    id: 'surveyTrial',
    initial: 'presenting',
    context: {
      questions,
      presentationMode,
      submitLabel,
      answers: {},
      currentQuestionIndex: 0,
      validationErrors: {},
      startTime: null,
      rt: null,
    },
    states: {
      presenting: {
        /**
         * Initial setup state. Records start time then immediately
         * enters the responding phase.
         */
        entry: 'recordStartTime',
        always: 'responding',
      },

      responding: {
        on: {
          ANSWER: {
            actions: 'recordAnswer',
          },
          NEXT_QUESTION: {
            actions: 'advanceQuestion',
          },
          PREV_QUESTION: {
            actions: 'retreatQuestion',
          },
          SUBMIT: {
            target: 'validating',
          },
        },
      },

      validating: {
        entry: 'validateResponses',
        always: [
          {
            guard: 'allValid',
            target: 'done',
            actions: 'recordCompletionTime',
          },
          {
            guard: 'hasValidationErrors',
            target: 'responding',
          },
        ],
      },

      done: { type: 'final' as const },
    },

    output: ({ context }) => ({
      answers: context.questions.map((q, i) => ({
        questionIndex: i,
        prompt: q.prompt,
        type: q.type,
        value: context.answers[i] ?? null,
      })),
      rt: context.rt,
    }),
  });
}
