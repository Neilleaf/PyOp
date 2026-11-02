import { describe, expect, it } from 'vitest';
import duplicates from '../../../../docs/examples/duplicates.json';
import fibonacci from '../../../../docs/examples/fibonacci.json';
import { demoBenchmarkService, parseBenchmarkResult } from './benchmarkService';
import { benchmarks } from './benchmarks';

describe('demo adapter and schema contract', () => {
  it('returns the original demo records without inventing measurements', async () => {
    expect(
      await demoBenchmarkService.load({
        benchmarkId: 'duplicates',
        inputSize: 1000,
        repetitions: 7,
      }),
    ).toEqual(duplicates);
    expect(
      await demoBenchmarkService.load({ benchmarkId: 'fibonacci', inputSize: 20, repetitions: 7 }),
    ).toEqual(fibonacci);
  });
  it.each([
    { benchmarkId: 'duplicates' as const, inputSize: 999, repetitions: 7 },
    { benchmarkId: 'fibonacci' as const, inputSize: 20, repetitions: 3 },
    { benchmarkId: 'fibonacci' as const, inputSize: 0, repetitions: 7 },
  ])('does not substitute a different configuration', async (configuration) => {
    expect(await demoBenchmarkService.load(configuration)).toBeNull();
  });
  it('rejects malformed results instead of displaying partial measurements', () => {
    expect(() => parseBenchmarkResult({ status: 'ok' })).toThrow(/schema/);
    const invalid = structuredClone(duplicates);
    invalid.variants[0].timing.median_ns = -1;
    expect(() => parseBenchmarkResult(invalid)).toThrow(/schema/);
  });
  it('accepts the existing structured failure contract', () => {
    const failure = {
      schema_version: '1.0',
      status: 'error',
      benchmark_id: 'unknown',
      input_size: null,
      repetitions: 7,
      warmups: 1,
      python_version: '3.12.1',
      variants: [],
      errors: [
        { phase: 'configuration', variant: '', type: 'ValueError', message: 'Unknown benchmark' },
      ],
    };
    expect(parseBenchmarkResult(failure)).toEqual(failure);
  });
  it('keeps supported demo defaults consistent with the measured records', () => {
    for (const record of [duplicates, fibonacci]) {
      const metadata = benchmarks[record.benchmark_id as keyof typeof benchmarks];
      expect(metadata.defaultSize).toBe(record.input_size);
      expect(record.input_size).toBeLessThanOrEqual(metadata.maxSize);
    }
  });
});
