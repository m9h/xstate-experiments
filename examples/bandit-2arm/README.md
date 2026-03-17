# Two-Armed Bandit

The simplest reinforcement learning task: choose between two slot machine arms, each with a hidden reward probability, and learn which one pays out more.

## What

A 2-arm bandit with 80 trials. On each trial the participant sees two arms, picks one, and receives binary feedback (reward or no reward). One arm has a 70% reward probability, the other 30%. The task measures the exploration-exploitation trade-off.

A Rescorla-Wagner model tracks Q-values across trials with learning rate alpha = 0.1.

## How to run

```bash
pnpm dev
```

Then open [http://localhost:5173](http://localhost:5173).

## What it demonstrates

- **Experiment machine factory**: A top-level XState machine manages instructions, trial sequencing, and results.
- **Trial actor invocation**: Each trial is an independent `banditTrialMachine` actor from `@xstate-experiments/core`, invoked and collected by the experiment machine.
- **Rescorla-Wagner Q-learning**: Q-values are threaded through the experiment context and updated after each trial via the Rescorla-Wagner delta rule: `Q_new = Q_old + alpha * (reward - Q_old)`.
- **Pure DOM rendering**: The renderer subscribes to the actor and updates the DOM based on state key changes, with no framework dependencies.

## Machine states

```
instructions ─[START]─> running ─[all 80 done]─> results
                           |
                     ┌─────┴──────┐
                     v            |
                   active     checkNext
                     |            ^
                     v            |
               ┌───────────┐     |
               │ Trial FSM │─────┘
               │ fixation   │
               │ stimulus   │
               │ feedback   │
               │ done       │
               └───────────┘
```

## Tests

```bash
pnpm vitest run examples/bandit-2arm/__tests__/
```

## References

- Rescorla, R. A., & Wagner, A. R. (1972). A theory of Pavlovian conditioning: Variations in the effectiveness of reinforcement and nonreinforcement. In A. H. Black & W. F. Prokasy (Eds.), *Classical conditioning II: Current research and theory* (pp. 64-99).
- Daw, N. D. (2011). Trial-by-trial data analysis using computational models. In M. R. Delgado, E. A. Phelps, & T. W. Robbins (Eds.), *Decision making, affect, and learning: Attention and performance XXIII* (pp. 3-38). Oxford University Press.
