import assert from 'node:assert/strict';
import health from '../.api-build/api/health.js';
import run from '../.api-build/api/benchmarks/run.js';

assert.equal((await health.fetch(new Request('http://localhost/api/health'))).status, 200);
const response = await run.fetch(
  new Request('http://localhost/api/benchmarks/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      benchmarkId: 'duplicates',
      inputSize: 1000,
      repetitions: 7,
    }),
  }),
);
assert.equal(response.status, 200);
const data = await response.json();
assert.equal(data.demo, true);
assert.equal(data.result.benchmark_id, 'duplicates');
console.log('Built API handlers and bundled recording smoke check passed.');
