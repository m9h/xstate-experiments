import { setup, assign } from 'xstate';

export interface BanditTrialInput {
  trialIndex: number;
  rewardProbabilities: [number, number];
  qValues: [number, number];
  alpha: number;
}

export interface BanditTrialContext {
  trialIndex: number;
  rewardProbabilities: [number, number];
  qValues: [number, number];
  alpha: number;
  chosenArm: 0 | 1 | null;
  reward: 0 | 1 | null;
  rt: number | null;
  stimulusOnsetTime: number | null;
  fixationOnsetTime: number | null;
  updatedQValues: [number, number];
}

export interface BanditTrialOutput {
  trialIndex: number;
  chosenArm: 0 | 1;
  reward: 0 | 1;
  rt: number;
  rewardProbabilities: [number, number];
  qValues: [number, number];
  updatedQValues: [number, number];
}

/**
 * Two-armed bandit trial machine.
 *
 * States: fixation (500ms) → stimulus (CHOOSE) → feedback (1500ms) → done
 *
 * Input: { trialIndex, rewardProbabilities, qValues, alpha }
 * Output: { trialIndex, chosenArm, reward, rt, rewardProbabilities, qValues, updatedQValues }
 */
export const banditTrialMachine = setup({
  types: {} as {
    context: BanditTrialContext;
    input: BanditTrialInput;
    events: { type: 'CHOOSE'; arm: 0 | 1 };
    output: BanditTrialOutput;
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

      // Rescorla-Wagner update
      const newQ: [number, number] = [...context.qValues] as [number, number];
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
  id: 'banditTrial',
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
      after: { 1500: 'done' },
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
