import { setup, assign } from 'xstate';
import { shuffle } from '@xstate-experiments/core';
import config from './config.json';

// ---------- Types ----------

export type TrialType = 'go' | 'nogo';

export interface GoNoGoTrialDef {
  trialType: TrialType;
  stimulus: string;
}

export interface GoNoGoTrialInput extends GoNoGoTrialDef {
  trialIndex: number;
}

export interface GoNoGoTrialContext {
  trialIndex: number;
  trialType: TrialType;
  stimulus: string;
  responded: boolean;
  rt: number | null;
  correct: boolean;
  stimulusOnsetTime: number | null;
}

export interface GoNoGoTrialOutput {
  trialIndex: number;
  trialType: TrialType;
  stimulus: string;
  responded: boolean;
  rt: number | null;
  correct: boolean;
}

// ---------- Parameters from config ----------

const {
  fixationDuration,
  feedbackDuration,
  stimulusDuration,
  goStimulus,
  nogoStimulus,
  goTrialProportion,
} = config.parameters;

const NUM_TRIALS = config.numTrials;

// ---------- Trial generation ----------

export function generateTrials(): GoNoGoTrialDef[] {
  const numGo = Math.round(NUM_TRIALS * goTrialProportion);
  const numNogo = NUM_TRIALS - numGo;

  const trials: GoNoGoTrialDef[] = [
    ...Array.from({ length: numGo }, () => ({
      trialType: 'go' as TrialType,
      stimulus: goStimulus,
    })),
    ...Array.from({ length: numNogo }, () => ({
      trialType: 'nogo' as TrialType,
      stimulus: nogoStimulus,
    })),
  ];

  return shuffle(trials);
}

// ---------- Trial machine ----------

export const goNoGoTrialMachine = setup({
  types: {} as {
    context: GoNoGoTrialContext;
    input: GoNoGoTrialInput;
    events: { type: 'KEYPRESS'; key: string; timestamp: number };
    output: GoNoGoTrialOutput;
  },
  actions: {
    recordStimulusOnset: assign({
      stimulusOnsetTime: () => performance.now(),
    }),
    recordResponse: assign(({ context, event }) => {
      const rt = performance.now() - (context.stimulusOnsetTime ?? performance.now());
      const correct = context.trialType === 'go';
      return {
        responded: true,
        rt,
        correct,
      };
    }),
    recordTimeout: assign(({ context }) => ({
      responded: false,
      rt: null as number | null,
      correct: context.trialType === 'nogo',
    })),
  },
  guards: {
    isValidResponse: ({ event }) => {
      return (event as { type: 'KEYPRESS'; key: string }).key === ' ';
    },
  },
  delays: {
    fixationDelay: () => fixationDuration,
    stimulusDelay: () => stimulusDuration,
    feedbackDelay: () => feedbackDuration,
  },
}).createMachine({
  id: 'goNoGoTrial',
  initial: 'fixation',
  context: ({ input }) => ({
    trialIndex: input.trialIndex,
    trialType: input.trialType,
    stimulus: input.stimulus,
    responded: false,
    rt: null,
    correct: false,
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
          target: 'evaluation',
          guard: 'isValidResponse',
          actions: 'recordResponse',
        },
      },
      after: {
        stimulusDelay: {
          target: 'evaluation',
          actions: 'recordTimeout',
        },
      },
    },
    evaluation: {
      always: 'feedback',
    },
    feedback: {
      after: { feedbackDelay: 'done' },
    },
    done: { type: 'final' },
  },
  output: ({ context }) => ({
    trialIndex: context.trialIndex,
    trialType: context.trialType,
    stimulus: context.stimulus,
    responded: context.responded,
    rt: context.rt,
    correct: context.correct,
  }),
});

// ---------- Experiment-level types ----------

export interface ExperimentContext {
  trials: GoNoGoTrialDef[];
  currentIndex: number;
  responses: GoNoGoTrialOutput[];
  goRT: number[];
  commissionErrors: number;
  omissionErrors: number;
  hits: number;
}

// ---------- Experiment machine ----------

export const goNoGoExperimentMachine = setup({
  types: {} as {
    context: ExperimentContext;
    events:
      | { type: 'START' }
      | { type: 'xstate.done.actor.currentTrial'; output: GoNoGoTrialOutput };
  },
  actors: {
    trialMachine: goNoGoTrialMachine,
  },
  actions: {
    collectResult: assign(({ context, event }) => {
      const output = (event as { output: GoNoGoTrialOutput }).output;
      const responses = [...context.responses, output];
      const goRT = output.trialType === 'go' && output.rt !== null
        ? [...context.goRT, output.rt]
        : context.goRT;
      const commissionErrors = context.commissionErrors +
        (output.trialType === 'nogo' && output.responded ? 1 : 0);
      const omissionErrors = context.omissionErrors +
        (output.trialType === 'go' && !output.responded ? 1 : 0);
      const hits = context.hits +
        (output.trialType === 'go' && output.responded ? 1 : 0);

      return {
        responses,
        currentIndex: context.currentIndex + 1,
        goRT,
        commissionErrors,
        omissionErrors,
        hits,
      };
    }),
  },
  guards: {
    hasMoreTrials: ({ context }) => context.currentIndex < context.trials.length,
  },
}).createMachine({
  id: 'goNoGoExperiment',
  initial: 'instructions',
  context: () => {
    const trials = generateTrials();
    return {
      trials,
      currentIndex: 0,
      responses: [],
      goRT: [],
      commissionErrors: 0,
      omissionErrors: 0,
      hits: 0,
    };
  },
  states: {
    instructions: {
      on: {
        START: 'running',
      },
    },
    running: {
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'currentTrial',
            src: 'trialMachine',
            input: ({ context }: { context: ExperimentContext }) => ({
              ...context.trials[context.currentIndex],
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
            { target: '#goNoGoExperiment.results' },
          ],
        },
      },
    },
    results: { type: 'final' },
  },
});
