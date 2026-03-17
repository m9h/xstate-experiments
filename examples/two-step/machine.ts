import { setup, assign } from 'xstate';
import config from './config.json';

// =============================================================================
// Two-Step Task — XState v5 Statechart Machines
//
// Flagship demo: hierarchical actor invocation.
// The experiment machine invokes trial machines, each of which invokes a
// stage2 child machine. Reward probabilities drift via Gaussian random walk.
//
// Reference: Daw, N. D., Gershman, S. J., Seymour, B., Dayan, P., & Dolan,
// R. J. (2011). Model-based influences on humans' choices and striatal
// prediction errors. Neuron, 69(6), 1204-1215.
// =============================================================================

const {
  commonTransitionProb,
  rewardDriftSigma,
  rewardMin,
  rewardMax,
  fixationDuration,
  stage1Timeout,
  stage2Timeout,
  feedbackDuration,
  itiDuration,
} = config.parameters;

const NUM_TRIALS = config.numTrials;

// ---------- Utility: Box-Muller normal random ----------

/** Sample from N(0,1) using Box-Muller transform. */
function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** Clamp a value to [lo, hi]. */
function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

// =============================================================================
// Types
// =============================================================================

export type TransitionType = 'common' | 'rare';

// ---------- Stage 2 types ----------

export interface Stage2Input {
  planet: 0 | 1;
  rewardProbs: [number, number];
  trialIndex: number;
}

export interface Stage2Context {
  planet: 0 | 1;
  rewardProbs: [number, number];
  trialIndex: number;
  chosenOption: 0 | 1 | null;
  reward: 0 | 1 | null;
  rt: number | null;
  stimulusOnsetTime: number | null;
}

export interface Stage2Output {
  chosenOption: 0 | 1;
  reward: 0 | 1;
  rt: number;
  planet: 0 | 1;
}

// ---------- Trial types ----------

export interface TrialInput {
  trialIndex: number;
  /** Transition probability matrix: transitionProbs[rocket][planet] */
  transitionProbs: [[number, number], [number, number]];
  /** Reward probabilities: rewardProbs[planet][option] */
  rewardProbs: [[number, number], [number, number]];
  stage1Timeout: number;
  stage2Timeout: number;
}

export interface TrialContext {
  trialIndex: number;
  transitionProbs: [[number, number], [number, number]];
  rewardProbs: [[number, number], [number, number]];
  stage1Timeout: number;
  stage2Timeout: number;
  stage1Choice: 0 | 1 | null;
  stage1RT: number | null;
  planet: 0 | 1 | null;
  transitionType: TransitionType | null;
  stage2Choice: 0 | 1 | null;
  stage2RT: number | null;
  reward: 0 | 1 | null;
  stage1OnsetTime: number | null;
}

export interface TrialOutput {
  trialIndex: number;
  stage1Choice: 0 | 1;
  stage2Choice: 0 | 1;
  planet: 0 | 1;
  transitionType: TransitionType;
  reward: 0 | 1;
  stage1RT: number;
  stage2RT: number;
}

// ---------- Experiment types ----------

export interface ExperimentContext {
  currentIndex: number;
  responses: TrialOutput[];
  totalReward: number;
  /** Drifting reward probabilities: [planet][option] */
  rewardProbs: [[number, number], [number, number]];
  /** Fixed transition probability matrix: [rocket][planet] */
  transitionProbs: [[number, number], [number, number]];
}

// =============================================================================
// Stage 2 Machine
// =============================================================================
//
// The second decision stage. The participant arrives at a planet and chooses
// one of two options. Each option pays out with a Bernoulli probability.
//
// States: stimulus --CHOOSE--> done
//
// Input:  { planet, rewardProbs: [p0, p1], trialIndex }
// Output: { chosenOption, reward, rt, planet }
// =============================================================================

export const twoStepStage2Machine = setup({
  types: {} as {
    context: Stage2Context;
    input: Stage2Input;
    events: { type: 'CHOOSE'; option: 0 | 1 };
    output: Stage2Output;
  },
  actions: {
    recordStimulusOnset: assign({
      stimulusOnsetTime: () => performance.now(),
    }),
    processChoice: assign(({ context, event }) => {
      const option = event.option;
      const reward: 0 | 1 = Math.random() < context.rewardProbs[option] ? 1 : 0;
      const rt = performance.now() - (context.stimulusOnsetTime ?? performance.now());
      return {
        chosenOption: option,
        reward,
        rt,
      };
    }),
  },
}).createMachine({
  id: 'twoStepStage2',
  initial: 'stimulus',
  context: ({ input }) => ({
    planet: input.planet,
    rewardProbs: input.rewardProbs,
    trialIndex: input.trialIndex,
    chosenOption: null,
    reward: null,
    rt: null,
    stimulusOnsetTime: null,
  }),
  states: {
    stimulus: {
      entry: 'recordStimulusOnset',
      on: {
        CHOOSE: {
          target: 'done',
          actions: 'processChoice',
        },
      },
    },
    done: { type: 'final' },
  },
  output: ({ context }) => ({
    chosenOption: context.chosenOption!,
    reward: context.reward!,
    rt: context.rt!,
    planet: context.planet,
  }),
});

// =============================================================================
// Trial Machine
// =============================================================================
//
// One complete two-step trial: fixation -> stage1 -> transition -> stage2 ->
// feedback -> iti -> done
//
// Stage1: participant chooses a rocket (0 or 1).
// Transition: determined probabilistically — common (0.7) or rare (0.3).
// Stage2: invokes the stage2 machine for the destination planet.
//
// Input: { trialIndex, transitionProbs, rewardProbs, stage1Timeout, stage2Timeout }
// Output: { trialIndex, stage1Choice, stage2Choice, planet, transitionType,
//           reward, stage1RT, stage2RT }
// =============================================================================

export const twoStepTrialMachine = setup({
  types: {} as {
    context: TrialContext;
    input: TrialInput;
    events:
      | { type: 'CHOOSE'; option: 0 | 1 }
      | { type: 'xstate.done.actor.stage2'; output: Stage2Output };
    output: TrialOutput;
  },
  actors: {
    stage2Machine: twoStepStage2Machine,
  },
  actions: {
    recordStage1Onset: assign({
      stage1OnsetTime: () => performance.now(),
    }),
    processStage1Choice: assign(({ context, event }) => {
      const rocket = (event as { type: 'CHOOSE'; option: 0 | 1 }).option;
      const rt = performance.now() - (context.stage1OnsetTime ?? performance.now());

      // Determine which planet the rocket goes to.
      // transitionProbs[rocket][planet] gives probability of reaching each planet.
      // The "common" planet for rocket i is planet i; the "rare" is planet 1-i.
      const commonPlanet = rocket;
      const roll = Math.random();
      const planet: 0 | 1 = roll < context.transitionProbs[rocket][commonPlanet]
        ? commonPlanet
        : (1 - commonPlanet) as 0 | 1;

      const transitionType: TransitionType =
        planet === commonPlanet ? 'common' : 'rare';

      return {
        stage1Choice: rocket,
        stage1RT: rt,
        planet,
        transitionType,
      };
    }),
    collectStage2Result: assign(({ event }) => {
      const output = (event as { output: Stage2Output }).output;
      return {
        stage2Choice: output.chosenOption,
        stage2RT: output.rt,
        reward: output.reward,
      };
    }),
  },
  delays: {
    fixationDelay: () => fixationDuration,
    transitionDelay: () => 300,
    feedbackDelay: () => feedbackDuration,
    itiDelay: () => itiDuration,
  },
}).createMachine({
  id: 'twoStepTrial',
  initial: 'fixation',
  context: ({ input }) => ({
    trialIndex: input.trialIndex,
    transitionProbs: input.transitionProbs,
    rewardProbs: input.rewardProbs,
    stage1Timeout: input.stage1Timeout,
    stage2Timeout: input.stage2Timeout,
    stage1Choice: null,
    stage1RT: null,
    planet: null,
    transitionType: null,
    stage2Choice: null,
    stage2RT: null,
    reward: null,
    stage1OnsetTime: null,
  }),
  states: {
    // Brief fixation cross
    fixation: {
      after: { fixationDelay: 'stage1' },
    },

    // Stage 1: choose a rocket
    stage1: {
      entry: 'recordStage1Onset',
      on: {
        CHOOSE: {
          target: 'transition',
          actions: 'processStage1Choice',
        },
      },
    },

    // Brief visual delay showing which planet was reached
    transition: {
      after: { transitionDelay: 'stage2' },
    },

    // Stage 2: invokes the stage2 machine for the destination planet
    stage2: {
      invoke: {
        id: 'stage2',
        src: 'stage2Machine',
        input: ({ context }: { context: TrialContext }) => ({
          planet: context.planet!,
          rewardProbs: context.rewardProbs[context.planet!],
          trialIndex: context.trialIndex,
        }),
        onDone: {
          target: 'feedback',
          actions: 'collectStage2Result',
        },
      },
    },

    // Show reward outcome
    feedback: {
      after: { feedbackDelay: 'iti' },
    },

    // Inter-trial interval (blank screen)
    iti: {
      after: { itiDelay: 'done' },
    },

    done: { type: 'final' },
  },
  output: ({ context }) => ({
    trialIndex: context.trialIndex,
    stage1Choice: context.stage1Choice!,
    stage2Choice: context.stage2Choice!,
    planet: context.planet!,
    transitionType: context.transitionType!,
    reward: context.reward!,
    stage1RT: context.stage1RT!,
    stage2RT: context.stage2RT!,
  }),
});

// =============================================================================
// Experiment Machine
// =============================================================================
//
// Orchestrates the full 200-trial session.
//
// States: instructions --START--> running (active / checkNext) --> results
//
// After each trial, reward probabilities drift via Gaussian random walk:
//   rewardProbs[p][o] += N(0, sigma), clamped to [rewardMin, rewardMax]
//
// The transition structure is fixed:
//   Rocket 0 -> Planet 0 (common, p=0.7) / Planet 1 (rare, p=0.3)
//   Rocket 1 -> Planet 1 (common, p=0.7) / Planet 0 (rare, p=0.3)
// =============================================================================

/** Apply Gaussian random walk to all 4 reward probabilities. */
function driftRewardProbs(
  probs: [[number, number], [number, number]],
): [[number, number], [number, number]] {
  return [
    [
      clamp(probs[0][0] + randn() * rewardDriftSigma, rewardMin, rewardMax),
      clamp(probs[0][1] + randn() * rewardDriftSigma, rewardMin, rewardMax),
    ],
    [
      clamp(probs[1][0] + randn() * rewardDriftSigma, rewardMin, rewardMax),
      clamp(probs[1][1] + randn() * rewardDriftSigma, rewardMin, rewardMax),
    ],
  ];
}

/** Build the fixed transition probability matrix from commonTransitionProb. */
function buildTransitionProbs(): [[number, number], [number, number]] {
  const p = commonTransitionProb;
  const q = 1 - p;
  return [
    [p, q],   // Rocket 0: p chance of Planet 0 (common), q chance of Planet 1 (rare)
    [q, p],   // Rocket 1: q chance of Planet 0 (rare), p chance of Planet 1 (common)
  ];
}

/** Initialize reward probabilities at 0.5 for all 4 planet-option pairs. */
function initRewardProbs(): [[number, number], [number, number]] {
  return [[0.5, 0.5], [0.5, 0.5]];
}

export const twoStepExperimentMachine = setup({
  types: {} as {
    context: ExperimentContext;
    events:
      | { type: 'START' }
      | { type: 'xstate.done.actor.currentTrial'; output: TrialOutput };
  },
  actors: {
    trialMachine: twoStepTrialMachine,
  },
  actions: {
    collectResult: assign(({ context, event }) => {
      const output = (event as { output: TrialOutput }).output;
      const responses = [...context.responses, output];
      const totalReward = context.totalReward + output.reward;

      // Apply Gaussian random walk to reward probabilities after each trial
      const rewardProbs = driftRewardProbs(context.rewardProbs);

      return {
        responses,
        currentIndex: context.currentIndex + 1,
        totalReward,
        rewardProbs,
      };
    }),
  },
  guards: {
    hasMoreTrials: ({ context }) => context.currentIndex < NUM_TRIALS,
  },
}).createMachine({
  id: 'twoStepExperiment',
  initial: 'instructions',
  context: () => ({
    currentIndex: 0,
    responses: [],
    totalReward: 0,
    rewardProbs: initRewardProbs(),
    transitionProbs: buildTransitionProbs(),
  }),
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
              trialIndex: context.currentIndex,
              transitionProbs: context.transitionProbs,
              rewardProbs: context.rewardProbs,
              stage1Timeout,
              stage2Timeout,
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
            { target: '#twoStepExperiment.results' },
          ],
        },
      },
    },
    results: { type: 'final' },
  },
});

// Re-export utilities for testing
export { randn, clamp, driftRewardProbs, buildTransitionProbs, initRewardProbs };
