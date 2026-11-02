import Ajv2020 from 'ajv/dist/2020.js';
import duplicates from '../docs/examples/duplicates.json';
import fibonacci from '../docs/examples/fibonacci.json';
import { parseBenchmarkResult } from '../packages/contracts/src/result.js';
import type {
  BenchmarkConfiguration,
  BenchmarkId,
  SuccessfulResult,
} from '../packages/contracts/src/benchmark.js';
import { ApiError } from './http.js';

const metadata = {
  duplicates: { name: 'Duplicate Detection', maxSize: 5000 },
  fibonacci: { name: 'Fibonacci', maxSize: 28 },
} as const;

const validateConfiguration = new Ajv2020({
  strict: true,
}).compile<BenchmarkConfiguration>({
  type: 'object',
  additionalProperties: false,
  required: ['benchmarkId', 'inputSize', 'repetitions'],
  properties: {
    benchmarkId: { type: 'string', enum: ['duplicates', 'fibonacci'] },
    inputSize: { type: 'integer', minimum: 0, maximum: 5000 },
    repetitions: { type: 'integer', minimum: 1, maximum: 30 },
  },
});

export function parseConfiguration(value: unknown): BenchmarkConfiguration {
  if (!validateConfiguration(value) || value.inputSize > metadata[value.benchmarkId].maxSize) {
    throw new ApiError(
      400,
      'INVALID_REQUEST',
      'Provide only benchmarkId (duplicates or fibonacci), an integer inputSize within its workload limit, and integer repetitions from 1 to 30. Source code is not accepted.',
    );
  }
  return value;
}

export function validateRecording(value: unknown): SuccessfulResult {
  const result = parseBenchmarkResult(value);
  if (
    result.status !== 'ok' ||
    result.variants.some((variant) => variant.timing.samples_ns.length !== result.repetitions)
  ) {
    throw new Error('The recorded result is incomplete.');
  }
  return result;
}

// Explicit static imports only. No request value becomes a filesystem path or import.
const records: Record<BenchmarkId, unknown> = { duplicates, fibonacci };

export function catalog() {
  return Object.entries(metadata).map(([benchmarkId, item]) => {
    const result = validateRecording(records[benchmarkId as BenchmarkId]);
    return {
      benchmarkId,
      name: item.name,
      limits: {
        inputSize: { min: 0, max: item.maxSize },
        repetitions: { min: 1, max: 30 },
      },
      recordings: [
        {
          inputSize: result.input_size,
          repetitions: result.repetitions,
          warmups: result.warmups,
          pythonVersion: result.python_version,
        },
      ],
    };
  });
}

export function findRecording(configuration: BenchmarkConfiguration): SuccessfulResult {
  const result = validateRecording(records[configuration.benchmarkId]);
  if (
    result.input_size !== configuration.inputSize ||
    result.repetitions !== configuration.repetitions
  ) {
    throw new ApiError(
      404,
      'RECORDING_NOT_FOUND',
      'No recorded demo matches this configuration. No code was executed.',
    );
  }
  return result;
}
