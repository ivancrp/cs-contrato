import { describe, it, expect } from 'vitest';
import { selectAlgorithm } from '../run-optimization.js';

describe('selectAlgorithm', () => {
  it('usa branch and bound para pools pequenos', () => {
    expect(selectAlgorithm(10)).toBe('branch_and_bound');
    expect(selectAlgorithm(25)).toBe('branch_and_bound');
  });

  it('usa simulated annealing para pools médios', () => {
    expect(selectAlgorithm(26)).toBe('simulated_annealing');
    expect(selectAlgorithm(80)).toBe('simulated_annealing');
  });

  it('usa genético para pools grandes', () => {
    expect(selectAlgorithm(81)).toBe('genetic');
  });
});
