import { createServer, type IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import health from '../api/health.js';
import benchmarks from '../api/benchmarks.js';
import run from '../api/benchmarks/run.js';
import { ApiError, errorResponse } from './http.js';

const routes = new Map([
  ['/api/health', health.fetch],
  ['/api/benchmarks', benchmarks.fetch],
  ['/api/benchmarks/run', run.fetch],
]);

/** Local-only adapter; production entrypoints are the three functions in api/. */
export function createApiServer() {
  const server = createServer(async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url ?? '/', 'http://127.0.0.1');
      const handler = routes.get(url.pathname);
      let response: Response;
      if (!handler)
        response = errorResponse(
          new ApiError(404, 'NOT_FOUND', 'No API endpoint matches this path.'),
        );
      else {
        const headers = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) {
          if (value !== undefined)
            headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        }
        const init: RequestInit & { duplex?: 'half' } = {
          method: incoming.method,
          headers,
        };
        if (!['GET', 'HEAD'].includes(incoming.method ?? 'GET')) {
          init.body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
          init.duplex = 'half';
        }
        response = await handler(new Request(url, init));
      }
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
      drain(incoming);
    } catch {
      const response = errorResponse(
        new ApiError(400, 'INVALID_REQUEST', 'The HTTP request could not be read.'),
      );
      if (!outgoing.headersSent)
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(await response.text());
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.timeout = 15_000;
  return server;
}

function drain(request: IncomingMessage) {
  if (!request.readableEnded) request.resume();
}
