import { describe, expect, it } from 'vitest';
import { calculateSpeedup, formatDuration, formatRatio } from './metrics';

describe('speedup calculations', () => {
  it('uses original median divided by optimized median, including slower results', () => {
    expect(calculateSpeedup(100, 20)).toBe(5);
    expect(calculateSpeedup(10, 20)).toBe(0.5);
    expect(calculateSpeedup(10, 10)).toBe(1);
    expect(calculateSpeedup(0.001, 0.0001)).toBe(10);
  });
  it.each([
    [0, 0],
    [10, 0],
    [-10, 20],
    [10, -1],
    [NaN, 1],
    [1, Infinity],
    [Number.MAX_VALUE, Number.MIN_VALUE],
    [Number.MIN_VALUE, Number.MAX_VALUE],
  ])('rejects unusable ratios %s / %s', (original, optimized) => {
    expect(calculateSpeedup(original, optimized)).toBeNull();
  });
});

describe('duration formatting', () => {
  it.each([
    [0, '0 ns'],
    [0.001, '<0.01 ns'],
    [0.1, '0.1 ns'],
    [900, '900 ns'],
    [8500, '8.5 µs'],
    [1058400, '1.06 ms'],
    [2e9, '2 s'],
    [NaN, 'Unavailable'],
    [Infinity, 'Unavailable'],
    [-1, 'Unavailable'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatDuration(value)).toBe(expected);
  });
  it('handles zero, tiny and invalid ratios without Infinity or a rounded zero', () => {
    expect(formatRatio(null)).toBe('Unavailable');
    expect(formatRatio(Infinity)).toBe('Unavailable');
    expect(formatRatio(0)).toBe('Unavailable');
    expect(formatRatio(0.001)).toBe('<0.01×');
    expect(formatRatio(124.517)).toBe('124.52×');
  });
});
