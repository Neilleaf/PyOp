import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import health from '../api/health.js';
import benchmarks from '../api/benchmarks.js';
import run from '../api/benchmarks/run.js';
import duplicates from '../docs/examples/duplicates.json';
import fibonacci from '../docs/examples/fibonacci.json';
import { parseBenchmarkResult } from '../packages/contracts/src/result.js';
import { endpoint, MAX_BODY_BYTES } from '../server/http.js';
import { createApiServer } from '../server/local.js';
import { validateRecording } from '../server/recordings.js';

const configuration = {
  benchmarkId: 'duplicates',
  inputSize: 1000,
  repetitions: 7,
};
function request(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/benchmarks/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
}
afterEach(() => vi.useRealTimers());

describe('Vercel function contracts', () => {
  it('reports health without implying live execution', async () => {
    const response = await health.fetch(new Request('http://localhost/api/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      service: 'PyOp API',
      demo: true,
      mode: 'recorded-demo',
      execution_enabled: false,
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('lists actual recorded configurations and workload-specific limits', async () => {
    const response = await benchmarks.fetch(new Request('http://localhost/api/benchmarks'));
    const body = await response.json();
    expect(body.demo).toBe(true);
    for (const record of [duplicates, fibonacci]) {
      const item = body.benchmarks.find(
        (item: { benchmarkId: string }) => item.benchmarkId === record.benchmark_id,
      );
      expect(item.recordings).toEqual([
        {
          inputSize: record.input_size,
          repetitions: record.repetitions,
          warmups: record.warmups,
          pythonVersion: record.python_version,
        },
      ]);
      expect(item.limits.inputSize.max).toBe(record.benchmark_id === 'duplicates' ? 5000 : 28);
    }
  });
  it.each([duplicates, fibonacci])(
    'returns unchanged, schema-valid $benchmark_id data in a demo envelope',
    async (record) => {
      const response = await run.fetch(
        request(
          JSON.stringify({
            benchmarkId: record.benchmark_id,
            inputSize: record.input_size,
            repetitions: record.repetitions,
          }),
        ),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.demo).toBe(true);
      expect(parseBenchmarkResult(body.result)).toEqual(record);
    },
  );
  it.each([
    {},
    [],
    null,
    1,
    'code',
    { ...configuration, benchmarkId: 'unknown' },
    { ...configuration, benchmarkId: '../fibonacci' },
    { ...configuration, inputSize: -1 },
    { ...configuration, inputSize: 5001 },
    { ...configuration, benchmarkId: 'fibonacci', inputSize: 29 },
    { ...configuration, inputSize: '1000' },
    { ...configuration, inputSize: true },
    { ...configuration, inputSize: 1.5 },
    { ...configuration, repetitions: 0 },
    { ...configuration, repetitions: 31 },
    { ...configuration, repetitions: '7' },
    { ...configuration, code: 'print(1)' },
    { ...configuration, source: 'print(1)' },
    { ...configuration, warmups: 1 },
  ])('rejects invalid or extended request %j', async (body) => {
    const response = await run.fetch(request(JSON.stringify(body)));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      demo: true,
      error: { code: 'INVALID_REQUEST', message: expect.any(String) },
    });
  });
  it.each(['', '{', '{"benchmarkId":}', '{"benchmarkId":"duplicates",}'])(
    'rejects malformed JSON %j',
    async (body) => {
      const response = await run.fetch(request(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: { code: 'INVALID_JSON' },
      });
    },
  );
  it.each<Record<string, string>>([
    { 'Content-Type': 'text/plain' },
    { 'Content-Type': 'application/json; charset=latin1' },
    { 'Content-Encoding': 'gzip' },
  ])('rejects unsupported encoding %j', async (headers) => {
    const response = await run.fetch(request('{}', headers));
    expect(response.status).toBe(415);
  });
  it('rejects oversized declared bodies before reading them', async () => {
    const response = await run.fetch(
      request('{}', { 'Content-Length': String(MAX_BODY_BYTES + 1) }),
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: 'PAYLOAD_TOO_LARGE' },
    });
  });
  it('counts actual bytes rather than trusting Content-Length or character counts', async () => {
    expect((await run.fetch(request(' '.repeat(1025), { 'Content-Length': '2' }))).status).toBe(
      413,
    );
    expect((await run.fetch(request('é'.repeat(513)))).status).toBe(413);
    const body = JSON.stringify(configuration).padEnd(MAX_BODY_BYTES, ' ');
    expect((await run.fetch(request(body))).status).toBe(200);
  });
  it('rejects invalid UTF-8 and malformed length headers', async () => {
    const invalid = new Request('http://localhost/api/benchmarks/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: new Uint8Array([0xff]),
    });
    expect((await run.fetch(invalid)).status).toBe(400);
    expect((await run.fetch(request('{}', { 'Content-Length': 'abc' }))).status).toBe(400);
  });
  it.each([0, 999, 5000])(
    'returns a no-recording error for valid unmatched size %i',
    async (inputSize) => {
      const response = await run.fetch(request(JSON.stringify({ ...configuration, inputSize })));
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        demo: true,
        error: { code: 'RECORDING_NOT_FOUND' },
      });
    },
  );
  it('returns no-recording for an unmatched repetition count', async () => {
    expect(
      (await run.fetch(request(JSON.stringify({ ...configuration, repetitions: 3 })))).status,
    ).toBe(404);
  });
  it.each([
    [health.fetch, 'GET'],
    [benchmarks.fetch, 'GET'],
    [run.fetch, 'POST'],
  ] as const)('rejects unsupported methods with Allow', async (handler, method) => {
    const response = await handler(new Request('http://localhost/api/health', { method: 'PUT' }));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe(method);
    expect(await response.json()).toMatchObject({
      demo: true,
      error: { code: 'METHOD_NOT_ALLOWED' },
    });
  });
  it('rejects extra query parameters and GET request bodies', async () => {
    expect(
      (await health.fetch(new Request('http://localhost/api/health?code=print(1)'))).status,
    ).toBe(400);
    expect(
      (
        await health.fetch(
          new Request('http://localhost/api/health', {
            headers: { 'Content-Length': '1' },
          }),
        )
      ).status,
    ).toBe(400);
  });
  it('times out stalled request bodies without waiting five real seconds', async () => {
    vi.useFakeTimers();
    const pending = run.fetch(
      new Request('http://localhost/api/benchmarks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: new ReadableStream(),
        duplex: 'half',
      } as RequestInit),
    );
    await vi.advanceTimersByTimeAsync(5001);
    expect((await pending).status).toBe(408);
  });
  it('hides internal failures behind a consistent error envelope', async () => {
    const broken = endpoint('GET', () => {
      throw new Error('private filesystem detail');
    });
    const response = await broken(new Request('http://localhost/api/health'));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({
      demo: true,
      error: { code: 'INTERNAL_ERROR' },
    });
    expect(JSON.stringify(body)).not.toContain('private filesystem');
  });
  it('refuses malformed, failed or incomplete server-side recordings', () => {
    expect(() => validateRecording({ status: 'ok' })).toThrow(/schema/);
    const record = structuredClone(duplicates);
    record.variants[0].timing.samples_ns.pop();
    expect(() => validateRecording(record)).toThrow(/incomplete/);
  });
});

describe('local HTTP transport', () => {
  const server = createApiServer();
  let origin: string;
  beforeAll(async () => {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
  it('serves all three routes over real HTTP', async () => {
    expect((await fetch(`${origin}/api/health`)).status).toBe(200);
    expect((await (await fetch(`${origin}/api/benchmarks`)).json()).demo).toBe(true);
    const response = await fetch(`${origin}/api/benchmarks/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configuration),
    });
    expect((await response.json()).result).toEqual(duplicates);
    expect((await fetch(`${origin}/api/missing`)).status).toBe(404);
  });
  it('rejects a chunked oversized upload with a readable 413 response', async () => {
    const received = await new Promise<{ status?: number; body: string }>((resolve, reject) => {
      const outgoing = httpRequest(
        `${origin}/api/benchmarks/run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked',
          },
        },
        (response) => {
          let body = '';
          response.on('data', (chunk) => {
            body += chunk.toString();
          });
          response.on('end', () => resolve({ status: response.statusCode, body }));
        },
      );
      outgoing.on('error', reject);
      outgoing.write(' '.repeat(700));
      outgoing.end(' '.repeat(700));
    });
    expect(received.status).toBe(413);
    expect(JSON.parse(received.body)).toMatchObject({
      demo: true,
      error: { code: 'PAYLOAD_TOO_LARGE' },
    });
  });
});
