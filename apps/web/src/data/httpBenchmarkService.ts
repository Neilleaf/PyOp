import { parseBenchmarkResult } from '../../../../packages/contracts/src/result';
import type { BenchmarkService } from './benchmarkService';

export class BenchmarkApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Only curated configuration crosses this boundary. Editor text is never serialized. */
export function createHttpBenchmarkService(
  fetcher: typeof fetch = (...args) => fetch(...args),
): BenchmarkService {
  return {
    async load(configuration) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        let response: Response;
        try {
          response = await fetcher('/api/benchmarks/run', {
            method: 'POST',
            credentials: 'omit',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              benchmarkId: configuration.benchmarkId,
              inputSize: configuration.inputSize,
              repetitions: configuration.repetitions,
            }),
          });
        } catch {
          throw new BenchmarkApiError(
            controller.signal.aborted
              ? 'The recorded-demo API timed out. Please retry.'
              : 'The recorded-demo API could not be reached. Check that the API is running and retry.',
            'NETWORK_ERROR',
            0,
          );
        }
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          throw new BenchmarkApiError(
            'The API returned an invalid JSON response.',
            'INVALID_RESPONSE',
            response.status,
          );
        }
        if (!object(body) || body.demo !== true)
          throw new BenchmarkApiError(
            'The API response is missing its recorded-demo label.',
            'INVALID_RESPONSE',
            response.status,
          );
        if (!response.ok) {
          if (
            !object(body.error) ||
            typeof body.error.code !== 'string' ||
            typeof body.error.message !== 'string'
          )
            throw new BenchmarkApiError(
              'The API returned an invalid error response.',
              'INVALID_RESPONSE',
              response.status,
            );
          if (response.status === 404 && body.error.code === 'RECORDING_NOT_FOUND') return null;
          throw new BenchmarkApiError(body.error.message, body.error.code, response.status);
        }
        const result = parseBenchmarkResult(body.result);
        if (
          result.benchmark_id !== configuration.benchmarkId ||
          result.input_size !== configuration.inputSize ||
          result.repetitions !== configuration.repetitions
        ) {
          throw new BenchmarkApiError(
            'The API returned a different benchmark configuration.',
            'INVALID_RESPONSE',
            response.status,
          );
        }
        return result;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export const httpBenchmarkService = createHttpBenchmarkService();
