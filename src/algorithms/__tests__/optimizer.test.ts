import { describe, it, expect } from 'vitest';
import { selectAlgorithm } from '../optimizer';

describe('selectAlgorithm', () => {
  it('usa branch and bound para pools pequenos', () => {
    expect(selectAlgorithm(20)).toBe('branch_and_bound');
  });

  it('usa simulated annealing para pools médios', () => {
    expect(selectAlgorithm(50)).toBe('simulated_annealing');
  });

  it('usa genetic para pools grandes', () => {
    expect(selectAlgorithm(120)).toBe('genetic');
  });
});
