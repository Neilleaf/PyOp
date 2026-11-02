import type { BenchmarkId } from '../types/benchmark';

// UI metadata follows the curated registry; measured data lives only in docs/examples.
export const benchmarks = {
  duplicates: {
    label: 'Duplicate Detection',
    description: 'Find repeated values: list scanning compared with a set-based approach.',
    sizeLabel: 'Input size',
    sizeUnit: 'elements',
    defaultSize: 1000,
    maxSize: 5000,
    optimizedName: 'Set-based',
  },
  fibonacci: {
    label: 'Fibonacci',
    description: 'Compute Fibonacci numbers: naive recursion compared with memoization.',
    sizeLabel: 'Fibonacci index',
    sizeUnit: 'index n',
    defaultSize: 20,
    maxSize: 28,
    optimizedName: 'Memoized',
  },
} satisfies Record<
  BenchmarkId,
  {
    label: string;
    description: string;
    sizeLabel: string;
    sizeUnit: string;
    defaultSize: number;
    maxSize: number;
    optimizedName: string;
  }
>;
