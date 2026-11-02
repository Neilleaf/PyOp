import { parseBenchmarkResult } from '../../../../packages/contracts/src/result';
import type { BenchmarkConfiguration, BenchmarkResult } from '../types/benchmark';

export { parseBenchmarkResult };

/** The UI accepts either the HTTP service or the retained local demo adapter. */
export interface BenchmarkService {
  load(configuration: BenchmarkConfiguration): Promise<BenchmarkResult | null>;
}

export const demoBenchmarkService: BenchmarkService = {
  async load(configuration) {
    const module =
      configuration.benchmarkId === 'duplicates'
        ? await import('../../../../docs/examples/duplicates.json')
        : await import('../../../../docs/examples/fibonacci.json');
    const result = parseBenchmarkResult(module.default);
    // Never substitute or synthesize measurements for an unsupported configuration.
    if (
      result.benchmark_id !== configuration.benchmarkId ||
      result.input_size !== configuration.inputSize ||
      result.repetitions !== configuration.repetitions
    )
      return null;
    return result;
  },
};
