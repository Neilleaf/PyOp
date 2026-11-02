/** Mirrors schemas/benchmark-result.schema.json, version 1.0. Times retain source units. */
export type BenchmarkId = 'duplicates' | 'fibonacci';

export interface TimingStatistics {
  unit: 'ns';
  samples_ns: number[];
  median_ns: number;
  min_ns: number;
  max_ns: number;
  mean_ns: number;
  stdev_ns: number;
  mad_ns: number;
}

export interface FunctionProfile {
  filename: string;
  line: number;
  function: string;
  primitive_calls: number;
  total_calls: number;
  self_time_seconds: number;
  cumulative_time_seconds: number;
}

export interface BenchmarkVariant {
  name: string;
  correctness_verified: true;
  timing: TimingStatistics;
  profile: FunctionProfile[];
}

export interface BenchmarkError {
  phase: 'configuration' | 'validation' | 'warmup' | 'timing' | 'profiling';
  variant: string;
  type: string;
  message: string;
}

interface ResultBase {
  schema_version: '1.0';
  benchmark_id: string;
  input_size: number | null;
  python_version: string;
  repetitions: number;
  warmups: number;
}

export interface SuccessfulResult extends ResultBase {
  status: 'ok';
  benchmark_id: BenchmarkId;
  input_size: number;
  variants: [BenchmarkVariant, BenchmarkVariant];
  errors: [];
}

export interface FailedResult extends ResultBase {
  status: 'error';
  variants: [];
  errors: BenchmarkError[];
}

export type BenchmarkResult = SuccessfulResult | FailedResult;

export interface BenchmarkConfiguration {
  benchmarkId: BenchmarkId;
  inputSize: number;
  repetitions: number;
}
