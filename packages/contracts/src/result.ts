import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../../schemas/benchmark-result.schema.json';
import type { BenchmarkResult } from './benchmark.js';

const validate = new Ajv2020({
  strict: false,
  strictNumbers: true,
}).compile<BenchmarkResult>(schema);

/** Shared runtime validation: never display or serve unvalidated result records. */
export function parseBenchmarkResult(value: unknown): BenchmarkResult {
  if (!validate(value))
    throw new Error('The benchmark result does not match the PyOp result schema.');
  return value;
}
