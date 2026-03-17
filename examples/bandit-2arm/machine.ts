import { setup, assign, createMachine, type AnyActorRef } from 'xstate';
import { banditTrialMachine, type BanditTrialInput, type BanditTrialOutput } from '@xstate-experiments/core';
import config from './config.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrialConfig {
  trialIndex: number;
  rewardProbabilities: [number, number];
  qValues: [number, number];
  alpha: number;
}

export interface ExperimentContext {
  trials: TrialConfig[];
  currentIndex: number;
  responses: BanditTrialOutput[];
  totalReward: number;
  qValues: [number, number];
  numTrials: number;
  rewardProbabilities: [number, number];
  alpha: number;
}

export type ExperimentEvent =
  | { type: 'START' }
  | { type: 'CHOOSE'; arm: 0 | 1 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTrials(
  numTrials: number,
  rewardProbabilities: [number, number],
  alpha: number,
): TrialConfig[] {
  const initialQ: [number, number] = [0.5, 0.5];
  return Array.from({ length: numTrials }, (_, i) => ({
    trialIndex: i,
    rewardProbabilities,
    qValues: initialQ, // will be overwritten at runtime with current Q
    alpha,
  }));
}

// ---------------------------------------------------------------------------
// Machine
// ---------------------------------------------------------------------------

const { numTrials, parameters } = config;
const rewardProbabilities: [number, number] = [
  parameters.rewardProb1,
  parameters.rewardProb2,
];

/**
 * Two-armed bandit experiment machine.
 *
 * Top-level states: instructions -> running -> results
 *
 * The `running` state invokes banditTrialMachine for each of 80 trials,
 * threading updated Q-values through so each trial starts from the
 * current learned values.
 *
 * Statechart:
 *
 *   instructions ─[START]─> running
 *     running
 *       active (invoke banditTrialMachine) ─[onDone]─> checkNext
 *       checkNext ─[hasMore]─> active
 *       checkNext ─[!hasMore]─> #results
 *   results (final)
 */
export const banditExperimentMachine = setup({
  types: {} as {
    context: ExperimentContext;
    events: ExperimentEvent;
  },
  actors: {
    banditTrial: banditTrialMachine,
  },
  actions: {
    collectResult: assign(({ context, event }) => {
      const output = (event as any).output as BanditTrialOutput;
      return {
        responses: [...context.responses, output],
        currentIndex: context.currentIndex + 1,
        totalReward: context.totalReward + output.reward,
        qValues: output.updatedQValues,
      };
    }),
  },
  guards: {
    hasMoreTrials: ({ context }) => context.currentIndex < context.numTrials,
  },
}).createMachine({
  id: 'bandit2arm',
  initial: 'instructions',
  context: {
    trials: buildTrials(numTrials, rewardProbabilities, parameters.alpha),
    currentIndex: 0,
    responses: [],
    totalReward: 0,
    qValues: [0.5, 0.5],
    numTrials,
    rewardProbabilities,
    alpha: parameters.alpha,
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
            src: 'banditTrial',
            input: ({ context }: { context: ExperimentContext }): BanditTrialInput => ({
              trialIndex: context.currentIndex,
              rewardProbabilities: context.rewardProbabilities,
              qValues: context.qValues,
              alpha: context.alpha,
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
            { target: '#bandit2arm.results' },
          ],
        },
      },
    },
    results: {
      type: 'final',
    },
  },
});
