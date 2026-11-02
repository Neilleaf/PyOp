# PyOp recorded-results API

Three TypeScript Vercel function entrypoints serve recordings only:

- `health.ts`: `GET /api/health`, with live execution explicitly disabled.
- `benchmarks.ts`: `GET /api/benchmarks`, listing limits and recorded configurations.
- `benchmarks/run.ts`: `POST /api/benchmarks/run`, accepting only `benchmarkId`,
  `inputSize`, and `repetitions`.

Shared implementation lives outside `api/` so helpers are not deployed as endpoints:

- `server/http.ts`: JSON responses, methods, strict body/media limits and errors.
- `server/recordings.ts`: request schema, static recording registry and result validation.
- `server/local.ts`: local Node HTTP adapter for these same handlers.
- `packages/contracts/src/`: result types and JSON Schema validation shared with the UI.

From the repository root, run `npm ci` and `npm ci --prefix apps/web`. In separate
terminals run `npm run dev:api` and `npm run dev:web`. Vite proxies `/api` to port 3001.
Run `npm test` for API and real HTTP tests, or `npm run build:api` to bundle the
handlers and smoke-test the built result. Vercel uses source functions, not the
local `.api-build/` artifacts. No deployment is performed by these commands.

Responses are marked `demo: true`; POST success is `{ demo: true, result }`. The
inner result is unchanged from `docs/examples/` and follows schema version 1.0.
Errors use `{ demo: true, error: { code, message } }`. Bodies are limited to 1,024
UTF-8 bytes with a 5-second read timeout. Only uncompressed JSON is accepted.
Source-code fields, extra keys and query parameters are rejected. No paths or
commands are built from request data; Python and shell subprocesses are never run.

See the [root README](../README.md) for exact status codes, examples, quality
commands, Vercel configuration and remaining isolation requirements.
