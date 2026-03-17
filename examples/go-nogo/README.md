# Go/No-Go Task

A Pavlovian Go/No-Go experiment built with XState v5 statecharts.

## What it measures

Response inhibition: the ability to suppress a pre-potent motor response. Participants must press the spacebar quickly on Go trials (`O`) and withhold their response on No-Go trials (`X`). The asymmetric trial ratio (75% Go) builds a prepotent "go" response, making inhibition on No-Go trials challenging.

## Key metrics

- **Go RT** -- average reaction time on correct Go trials
- **Commission errors** -- pressing on No-Go trials (failure to inhibit)
- **Omission errors** -- failing to press on Go trials
- **Hit rate** -- proportion of Go trials with a correct response

## How to run

```bash
# from the monorepo root
pnpm dev --filter @xstate-experiments/example-go-nogo
```

Then open the local dev server URL in your browser.

## What it demonstrates

Compared to the simpler bandit example, this task adds:

- **Response deadlines** -- the stimulus disappears after 1000 ms; no late responses
- **Trial-type variation** -- two trial types (go/nogo) with different correct responses
- **Guards** -- `isValidResponse` checks that only the spacebar triggers a response
- **Transient evaluation state** -- correctness is computed in an intermediate state that transitions immediately to feedback

### Statechart structure

**Trial machine:** `fixation` -> `stimulus` -> `evaluation` -> `feedback` -> `done`

**Experiment machine:** `instructions` -> `running` (`active` / `checkNext`) -> `results`

## Citations

- Guitart-Masip, M., Huys, Q. J. M., Fuentemilla, L., Dayan, P., Duzel, E., & Dolan, R. J. (2012). Go and no-go learning in reward and punishment: Interactions between affect and effect. *NeuroImage*, 62(1), 154--166. https://doi.org/10.1016/j.neuroimage.2012.04.024
- Wessel, J. R. (2018). Prepotent motor activity and inhibitory control demands in different variants of the go/no-go paradigm. *Psychophysiology*, 55(3), e12871. https://doi.org/10.1111/psyp.12871
