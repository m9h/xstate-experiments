// Core machines
export { createExperimentMachine } from './machines/experiment';
export type { ExperimentConfig, ExperimentContext } from './machines/experiment';

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
