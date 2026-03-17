# Reversal Learning

A 3-arm bandit task where the best option changes halfway through. This experiment measures **cognitive flexibility** -- the ability to detect and adapt to changing reward contingencies.

## Task structure

- **120 trials** split into two phases of 60
- **Phase 1** (trials 0-59): reward probabilities are `[0.7, 0.2, 0.1]` for arms 1, 2, 3
- **Phase 2** (trials 60-119): probabilities flip to `[0.1, 0.2, 0.7]`
- On each trial: fixation cross (500ms) -> choose an arm (click or keypress 1/2/3) -> feedback (1000ms)

Reward is sampled stochastically (Bernoulli) on each trial. A Rescorla-Wagner learning rule updates Q-values internally for analysis.

## Running

```bash
cd examples/reversal-learning
pnpm dev
```

Or from the monorepo root:

```bash
pnpm --filter @xstate-experiments/example-reversal-learning dev
```

## Testing

```bash
pnpm vitest run examples/reversal-learning/__tests__/machine.test.ts
```

## What this demonstrates

- **Mid-task contingency changes**: reward probabilities switch at a configurable reversal point, requiring participants to override learned associations
- **Guard-based probability switching**: the experiment machine's input function checks `currentIndex` against `reversalTrial` to determine which probability set to pass to each trial actor -- no separate "phase" states needed
- **Hierarchical actor composition**: the experiment machine invokes trial machines as child actors, passing updated Q-values and probabilities via input
- **Rescorla-Wagner learning**: Q-value updates are computed inside the trial machine's `processChoice` action, then propagated back to the experiment machine via trial output

## Results metrics

| Metric | Description |
|---|---|
| Total reward | Sum of all rewards earned across 120 trials |
| Pre-reversal accuracy | Proportion of trials choosing the best arm in Phase 1 |
| Post-reversal accuracy | Proportion of trials choosing the new best arm in Phase 2 |
| Adaptation speed | Number of trials after reversal until the participant first selects the new best arm |

## References

- Izquierdo, A., & Jentsch, J.D. (2012). Reversal learning as a measure of impulsive and compulsive behavior in addictions. *Psychopharmacology*, 219(2), 607-620.
- Rescorla, R.A., & Wagner, A.R. (1972). A theory of Pavlovian conditioning: Variations in the effectiveness of reinforcement and nonreinforcement. In A.H. Black & W.F. Prokasy (Eds.), *Classical Conditioning II* (pp. 64-99). Appleton-Century-Crofts.
- Cools, R., Clark, L., Owen, A.M., & Robbins, T.W. (2002). Defining the neural mechanisms of probabilistic reversal learning using event-related functional magnetic resonance imaging. *Journal of Neuroscience*, 22(11), 4563-4567.
