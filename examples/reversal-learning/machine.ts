import { setup, assign } from 'xstate';
import config from './config.json';

// ─── Types ───────────────────────────────────────────────────────────────────

type Arm = 0 | 1 | 2;

export interface ReversalTrialInput {
  trialIndex: number;
  rewardProbabilities: [number, number, number];
  qValues: [number, number, number];
  alpha: number;
}

export interface ReversalTrialContext {
  trialIndex: number;
  rewardProbabilities: [number, number, number];
  qValues: [number, number, number];
  alpha: number;
  chosenArm: Arm | null;
  reward: 0 | 1 | null;
  rt: number | null;
  stimulusOnsetTime: number | null;
  fixationOnsetTime: number | null;
  updatedQValues: [number, number, number];
}

export interface ReversalTrialOutput {
  trialIndex: number;
  chosenArm: Arm;
  reward: 0 | 1;
  rt: number;
  rewardProbabilities: [number, number, number];
  qValues: [number, number, number];
  updatedQValues: [number, number, number];
}

export interface ReversalExperimentContext {
  config: typeof config;
  currentIndex: number;
  responses: ReversalTrialOutput[];
  totalReward: number;
  qValues: [number, number, number];
  startTime: number | null;
}

// ─── Trial Machine ──────────────────────────────────────────────────────────

/**
 * Three-armed bandit trial machine with Rescorla-Wagner learning.
 *
 * States: fixation (500ms) -> stimulus (CHOOSE event) -> feedback (1000ms) -> done
 *
 * Input: { trialIndex, rewardProbabilities, qValues, alpha }
 * Output: { trialIndex, chosenArm, reward, rt, rewardProbabilities, qValues, updatedQValues }
 */
export const reversalTrialMachine = setup({
  types: {} as {
    context: ReversalTrialContext;
    input: ReversalTrialInput;
    events: { type: 'CHOOSE'; arm: Arm };
    output: ReversalTrialOutput;
  },
  actions: {
    recordFixationOnset: assign({
      fixationOnsetTime: () => performance.now(),
    }),
    recordStimulusOnset: assign({
      stimulusOnsetTime: () => performance.now(),
    }),
    processChoice: assign(({ context, event }) => {
      const arm = event.arm;
      const reward: 0 | 1 = Math.random() < context.rewardProbabilities[arm] ? 1 : 0;
      const rt = performance.now() - (context.stimulusOnsetTime ?? performance.now());

      // Rescorla-Wagner update: Q[arm] += alpha * (reward - Q[arm])
      const newQ: [number, number, number] = [...context.qValues] as [number, number, number];
      newQ[arm] += context.alpha * (reward - newQ[arm]);

      return {
        chosenArm: arm,
        reward,
        rt,
        updatedQValues: newQ,
      };
    }),
  },
}).createMachine({
  id: 'reversalTrial',
  initial: 'fixation',
  context: ({ input }) => ({
    trialIndex: input.trialIndex,
    rewardProbabilities: input.rewardProbabilities,
    qValues: input.qValues,
    alpha: input.alpha,
    chosenArm: null,
    reward: null,
    rt: null,
    stimulusOnsetTime: null,
    fixationOnsetTime: null,
    updatedQValues: input.qValues,
  }),
  states: {
    fixation: {
      entry: 'recordFixationOnset',
      after: { 500: 'stimulus' },
    },
    stimulus: {
      entry: 'recordStimulusOnset',
      on: {
        CHOOSE: {
          target: 'feedback',
          actions: 'processChoice',
        },
      },
    },
    feedback: {
      after: { 1000: 'done' },
    },
    done: { type: 'final' },
  },
  output: ({ context }) => ({
    trialIndex: context.trialIndex,
    chosenArm: context.chosenArm!,
    reward: context.reward!,
    rt: context.rt!,
    rewardProbabilities: context.rewardProbabilities,
    qValues: context.qValues,
    updatedQValues: context.updatedQValues,
  }),
});

// ─── Experiment Machine ─────────────────────────────────────────────────────

/**
 * Reversal learning experiment machine.
 *
 * Statechart:
 *   instructions -> running (active / checkNext) -> results
 *
 * Key feature: reward probabilities switch at the reversal point.
 * A guard checks currentIndex against reversalTrial to determine
 * which probability set to pass to each trial actor.
 */
export const reversalExperimentMachine = setup({
  types: {} as {
    context: ReversalExperimentContext;
    events:
      | { type: 'START' }
      | { type: 'CHOOSE'; arm: Arm };
  },
  actors: {
    trialMachine: reversalTrialMachine,
  },
  actions: {
    recordStartTime: assign({
      startTime: () => performance.now(),
    }),
    collectResult: assign({
      responses: ({ context, event }) => {
        const output = (event as any).output as ReversalTrialOutput;
        return [...context.responses, output];
      },
      currentIndex: ({ context }) => context.currentIndex + 1,
      totalReward: ({ context, event }) => {
        const output = (event as any).output as ReversalTrialOutput;
        return context.totalReward + output.reward;
      },
      qValues: ({ context, event }) => {
        const output = (event as any).output as ReversalTrialOutput;
        return output.updatedQValues;
      },
    }),
  },
  guards: {
    hasMoreTrials: ({ context }) => context.currentIndex < context.config.numTrials,
  },
}).createMachine({
  id: 'reversalExperiment',
  initial: 'instructions',
  context: {
    config,
    currentIndex: 0,
    responses: [],
    totalReward: 0,
    qValues: [0.5, 0.5, 0.5],
    startTime: null,
  },
  states: {
    instructions: {
      on: {
        START: {
          target: 'running',
          actions: 'recordStartTime',
        },
      },
    },
    running: {
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'currentTrial',
            src: 'trialMachine',
            input: ({ context }: { context: ReversalExperimentContext }) => {
              // Guard-based probability switching at the reversal point
              const probs =
                context.currentIndex < context.config.parameters.reversalTrial
                  ? context.config.parameters.preReversalProbs
                  : context.config.parameters.postReversalProbs;

              return {
                trialIndex: context.currentIndex,
                rewardProbabilities: probs as [number, number, number],
                qValues: context.qValues,
                alpha: context.config.parameters.alpha,
              };
            },
            onDone: {
              target: 'checkNext',
              actions: 'collectResult',
            },
          },
        },
        checkNext: {
          always: [
            { target: 'active', guard: 'hasMoreTrials' },
            { target: '#reversalExperiment.results' },
          ],
        },
      },
    },
    results: { type: 'final' as const },
  },
});
