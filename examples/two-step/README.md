# Two-Step Task

The flagship jsPsych2 demo: a two-stage Markov decision task built with XState v5 statecharts.

## What it measures

The two-step task dissociates model-free (habitual) from model-based (planning) decision strategies. On each trial, participants choose a "rocket" that probabilistically transitions to one of two "planets," then choose an option on that planet for a chance at reward. Reward probabilities drift over time via Gaussian random walk.

The critical diagnostic is the pattern of **stay probabilities** conditioned on previous trial outcome and transition type:

- **Model-free** learners show a main effect of reward (stay after reward, switch after no reward), regardless of transition type.
- **Model-based** learners show an interaction: they stay after common + reward *and* rare + no reward, because they understand the transition structure.

## How to run

```bash
# from the monorepo root
pnpm dev --filter @xstate-experiments/example-two-step
```

Then open the local dev server URL in your browser.

## What it demonstrates

This is the most architecturally complex example in the repo, showcasing:

- **Hierarchical actor invocation** -- the experiment machine invokes trial machines, each of which invokes a nested stage2 machine. This is XState's `invoke` composing actors across three levels.
- **Drifting reward probabilities** -- Gaussian random walk applied after each trial, keeping probabilities clamped to [0.25, 0.75].
- **Probabilistic transition structure** -- a 2x2 transition matrix determines which planet each rocket reaches (70% common, 30% rare).
- **Multi-stage trial flow** -- fixation -> stage1 -> transition -> stage2 -> feedback -> ITI, all as explicit statechart states.

### Statechart structure

**Stage2 machine:** `stimulus` --CHOOSE--> `done`

**Trial machine:** `fixation` -> `stage1` -> `transition` -> `stage2` (invokes stage2 machine) -> `feedback` -> `iti` -> `done`

**Experiment machine:** `instructions` -> `running` (`active` / `checkNext`) -> `results`

## Citation

Daw, N. D., Gershman, S. J., Seymour, B., Dayan, P., & Dolan, R. J. (2011). Model-based influences on humans' choices and striatal prediction errors. *Neuron*, 69(6), 1204--1215. https://doi.org/10.1016/j.neuron.2011.02.027
