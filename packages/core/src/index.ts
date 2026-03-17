// Machine factories
export { createExperimentMachine } from './machines/experiment';
export type { ExperimentConfig, ExperimentContext } from './machines/experiment';

export { createBlockMachine } from './machines/block';
export type { BlockConfig, BlockContext } from './machines/block';

export { createTrialMachine } from './machines/trial';
export type {
  TrialConfig,
  BaseTrialInput,
  BaseTrialContext,
  BaseTrialOutput,
} from './machines/trial';

// Trial machines
export { banditTrialMachine } from './machines/trials/bandit';
export type { BanditTrialInput, BanditTrialOutput } from './machines/trials/bandit';
export { keyboardTrialMachine } from './machines/trials/keyboard-response';
export type { KeyboardTrialInput, KeyboardTrialOutput } from './machines/trials/keyboard-response';

// Actors
export { timingMonitor, now, onNextFrame } from './actors/timing';
export { dataCollectorMachine } from './actors/data-collector';
export type { TrialResult } from './actors/data-collector';
export { keyboardInput, mouseInput } from './actors/input';

// Utilities
export {
  evaluateGrid,
  evaluateResponse,
  shuffle,
  latinSquare,
  counterbalance,
  randomize,
  afterNCorrect,
  afterNTrials,
  staircaseRule,
} from './utils';
export type { EvaluationResult } from './utils';
