/**
 * Utility functions for experiment design: scoring, randomization, and guard helpers.
 */

// ---------- Response evaluation ----------

export interface EvaluationResult {
  correct: boolean;
  accuracy: number;
  totalCells: number;
  correctCells: number;
}

/**
 * Compare a submitted grid (2D array) to an expected grid, cell by cell.
 * Generic scoring for grid-based tasks (ARC, spatial recall, etc.)
 */
export function evaluateGrid(
  submitted: unknown[][],
  expected: unknown[][]
): EvaluationResult {
  let correctCells = 0;
  let totalCells = 0;

  for (let r = 0; r < expected.length; r++) {
    for (let c = 0; c < (expected[r]?.length ?? 0); c++) {
      totalCells++;
      if (submitted[r]?.[c] === expected[r][c]) {
        correctCells++;
      }
    }
  }

  return {
    correct: correctCells === totalCells,
    accuracy: totalCells > 0 ? correctCells / totalCells : 0,
    totalCells,
    correctCells,
  };
}

/**
 * Compare a single response value to an expected value.
 */
export function evaluateResponse(
  submitted: unknown,
  expected: unknown
): { correct: boolean } {
  return { correct: submitted === expected };
}

// ---------- Randomization ----------

/**
 * Fisher-Yates shuffle. Returns a new array.
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generate a balanced Latin square of size n.
 * Returns an n×n matrix where each row is a permutation of 0..n-1,
 * and each value appears exactly once in each column.
 */
export function latinSquare(n: number): number[][] {
  const square: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      row.push((i + j) % n);
    }
    square.push(row);
  }
  return square;
}

/**
 * Counterbalance: given conditions and a participant index,
 * return the condition order for that participant using Latin square.
 */
export function counterbalance(conditions: string[], participantIndex: number): string[] {
  const n = conditions.length;
  const square = latinSquare(n);
  const row = square[participantIndex % n];
  return row.map(i => conditions[i]);
}

/**
 * Randomize trials using the specified method.
 */
export function randomize<T>(
  trials: T[],
  method: 'shuffle' | 'none' = 'shuffle'
): T[] {
  switch (method) {
    case 'shuffle':
      return shuffle(trials);
    case 'none':
      return [...trials];
  }
}

// ---------- Guard helpers ----------

/**
 * Guard: returns true after n consecutive correct responses.
 * Use in staircase / mastery procedures.
 */
export function afterNCorrect(n: number) {
  return ({ context }: { context: { results?: Array<{ correct?: boolean }> } }) => {
    const results = context.results ?? [];
    if (results.length < n) return false;
    const lastN = results.slice(-n);
    return lastN.every(r => r.correct === true);
  };
}

/**
 * Guard: returns true after n total trials have been completed.
 */
export function afterNTrials(n: number) {
  return ({ context }: { context: { currentIndex?: number; results?: unknown[] } }) => {
    const count = context.currentIndex ?? context.results?.length ?? 0;
    return count >= n;
  };
}

/**
 * Staircase rule: increase difficulty after `down` correct, decrease after `up` incorrect.
 * Returns { shouldIncrease, shouldDecrease } guard functions.
 */
export function staircaseRule(up: number, down: number) {
  return {
    shouldIncrease: afterNCorrect(down),
    shouldDecrease: ({ context }: { context: { results?: Array<{ correct?: boolean }> } }) => {
      const results = context.results ?? [];
      if (results.length < up) return false;
      const lastN = results.slice(-up);
      return lastN.every(r => r.correct === false);
    },
  };
}
