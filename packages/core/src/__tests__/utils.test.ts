import { describe, it, expect } from 'vitest';
import {
  evaluateGrid,
  evaluateResponse,
  shuffle,
  latinSquare,
  counterbalance,
  randomize,
  afterNCorrect,
  afterNTrials,
  staircaseRule,
} from '../utils';

describe('evaluateGrid', () => {
  it('should return correct=true for matching grids', () => {
    const grid = [[1, 2], [3, 4]];
    const result = evaluateGrid(grid, grid);
    expect(result.correct).toBe(true);
    expect(result.accuracy).toBe(1);
    expect(result.totalCells).toBe(4);
    expect(result.correctCells).toBe(4);
  });

  it('should return correct=false for mismatched grids', () => {
    const submitted = [[1, 2], [3, 0]];
    const expected = [[1, 2], [3, 4]];
    const result = evaluateGrid(submitted, expected);
    expect(result.correct).toBe(false);
    expect(result.accuracy).toBe(0.75);
    expect(result.correctCells).toBe(3);
  });

  it('should handle empty grids', () => {
    const result = evaluateGrid([], []);
    expect(result.correct).toBe(true);
    expect(result.accuracy).toBe(0); // 0/0
  });
});

describe('evaluateResponse', () => {
  it('should return correct=true for matching values', () => {
    expect(evaluateResponse('a', 'a').correct).toBe(true);
  });

  it('should return correct=false for mismatched values', () => {
    expect(evaluateResponse('a', 'b').correct).toBe(false);
  });
});

describe('shuffle', () => {
  it('should return array of same length', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result).toHaveLength(5);
    expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('should not mutate original array', () => {
    const arr = [1, 2, 3];
    shuffle(arr);
    expect(arr).toEqual([1, 2, 3]);
  });
});

describe('latinSquare', () => {
  it('should return n×n matrix', () => {
    const square = latinSquare(3);
    expect(square).toHaveLength(3);
    expect(square[0]).toHaveLength(3);
  });

  it('should have each value 0..n-1 exactly once per column', () => {
    const square = latinSquare(4);
    for (let col = 0; col < 4; col++) {
      const colValues = square.map(row => row[col]);
      expect(colValues.sort()).toEqual([0, 1, 2, 3]);
    }
  });

  it('should have each value 0..n-1 exactly once per row', () => {
    const square = latinSquare(4);
    for (const row of square) {
      expect([...row].sort()).toEqual([0, 1, 2, 3]);
    }
  });
});

describe('counterbalance', () => {
  it('should return permuted conditions', () => {
    const conditions = ['A', 'B', 'C'];
    const result = counterbalance(conditions, 0);
    expect(result).toHaveLength(3);
    expect(result.sort()).toEqual(['A', 'B', 'C']);
  });

  it('should give different orders for different participant indices', () => {
    const conditions = ['A', 'B', 'C'];
    const order0 = counterbalance(conditions, 0);
    const order1 = counterbalance(conditions, 1);
    expect(order0).not.toEqual(order1);
  });
});

describe('randomize', () => {
  it('should return copy with method=none', () => {
    const trials = [1, 2, 3];
    const result = randomize(trials, 'none');
    expect(result).toEqual([1, 2, 3]);
    expect(result).not.toBe(trials);
  });

  it('should shuffle with method=shuffle', () => {
    const trials = Array.from({ length: 100 }, (_, i) => i);
    const result = randomize(trials, 'shuffle');
    expect(result).toHaveLength(100);
    // Very unlikely to be identical after shuffle
    expect(result).not.toEqual(trials);
  });
});

describe('afterNCorrect', () => {
  it('should return false when fewer than n results', () => {
    const guard = afterNCorrect(3);
    expect(guard({ context: { results: [{ correct: true }] } })).toBe(false);
  });

  it('should return true when last n are all correct', () => {
    const guard = afterNCorrect(3);
    const results = [
      { correct: false },
      { correct: true },
      { correct: true },
      { correct: true },
    ];
    expect(guard({ context: { results } })).toBe(true);
  });

  it('should return false when last n are not all correct', () => {
    const guard = afterNCorrect(3);
    const results = [
      { correct: true },
      { correct: false },
      { correct: true },
    ];
    expect(guard({ context: { results } })).toBe(false);
  });
});

describe('afterNTrials', () => {
  it('should return false when fewer than n trials', () => {
    const guard = afterNTrials(5);
    expect(guard({ context: { currentIndex: 3 } })).toBe(false);
  });

  it('should return true when at least n trials', () => {
    const guard = afterNTrials(5);
    expect(guard({ context: { currentIndex: 5 } })).toBe(true);
    expect(guard({ context: { currentIndex: 10 } })).toBe(true);
  });
});

describe('staircaseRule', () => {
  it('should detect when to increase difficulty', () => {
    const { shouldIncrease } = staircaseRule(1, 3);
    const results = [
      { correct: true },
      { correct: true },
      { correct: true },
    ];
    expect(shouldIncrease({ context: { results } })).toBe(true);
  });

  it('should detect when to decrease difficulty', () => {
    const { shouldDecrease } = staircaseRule(2, 3);
    const results = [
      { correct: true },
      { correct: false },
      { correct: false },
    ];
    expect(shouldDecrease({ context: { results } })).toBe(true);
  });
});
