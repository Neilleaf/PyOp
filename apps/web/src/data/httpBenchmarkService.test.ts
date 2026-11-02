import { afterEach, describe, expect, it, vi } from 'vitest';
import duplicates from '../../../../docs/examples/duplicates.json';
import { createHttpBenchmarkService } from './httpBenchmarkService';

const configuration = { benchmarkId: 'duplicates' as const, inputSize: 1000, repetitions: 7 };
afterEach(() => vi.useRealTimers());

describe('HTTP benchmark adapter', () => {
  it('sends only the three configuration fields and validates the demo response', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ demo: true, result: duplicates }));
    const service = createHttpBenchmarkService(transport);
    expect(
      await service.load({
        ...configuration,
        code: 'must not leave the editor',
      } as typeof configuration),
    ).toEqual(duplicates);
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe('/api/benchmarks/run');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(configuration);
    expect(init?.credentials).toBe('omit');
  });
  it('maps only RECORDING_NOT_FOUND to an empty result', async () => {
    const service = createHttpBenchmarkService(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { demo: true, error: { code: 'RECORDING_NOT_FOUND', message: 'No recording' } },
            { status: 404 },
          ),
        ),
    );
    expect(await service.load(configuration)).toBeNull();
  });
  it.each([400, 404, 413, 500])('preserves API errors at HTTP %i', async (status) => {
    const service = createHttpBenchmarkService(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { demo: true, error: { code: 'FAILURE', message: 'Request rejected' } },
            { status },
          ),
        ),
    );
    await expect(service.load(configuration)).rejects.toMatchObject({
      code: 'FAILURE',
      status,
      message: 'Request rejected',
    });
  });
  it.each([
    { result: duplicates },
    { demo: false, result: duplicates },
    { demo: true, result: { status: 'ok' } },
    { demo: true, result: { ...duplicates, input_size: 42 } },
  ])('rejects missing labels, malformed results or mismatched configurations', async (body) => {
    const service = createHttpBenchmarkService(
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(body)),
    );
    await expect(service.load(configuration)).rejects.toThrow();
  });
  it('reports network and non-JSON failures clearly', async () => {
    const offline = createHttpBenchmarkService(
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed')),
    );
    await expect(offline.load(configuration)).rejects.toThrow(/could not be reached/);
    const html = createHttpBenchmarkService(
      vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>error</html>', { status: 502 })),
    );
    await expect(html.load(configuration)).rejects.toThrow(/invalid JSON/);
  });
  it('aborts a stalled HTTP request', async () => {
    vi.useFakeTimers();
    const transport = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const pending = createHttpBenchmarkService(transport).load(configuration);
    const assertion = expect(pending).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(10_001);
    await assertion;
  });
});
