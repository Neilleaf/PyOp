# PyOp — Python Optimizer

PyOp is a Python performance analysis project being built incrementally for public
deployment. The future website will let users paste Python code, inspect bottlenecks,
and compare implementations. **Step 3 connects the React interface to a Node.js
recorded-results API.** The Python editor remains local and custom-code analysis
stays disabled. The API serves captured measurements from `docs/examples/` only;
it never runs Python. There is no account system, database, or saved history.

## Repository layout

```text
PyOp/                         existing workspace root
├── apps/web/                 Vite + React + TypeScript demo frontend
├── api/                      three TypeScript Vercel function entrypoints
├── server/                   request validation, recording lookup, local HTTP adapter
├── packages/contracts/       shared result types and JSON Schema validation
├── tests/                    API contracts and real HTTP transport tests
├── scripts/                  built API handler smoke check
├── packages/engine/
│   ├── src/pyop/             installable Python engine and CLI
│   └── tests/                correctness, contract, and behavior tests
├── schemas/                  versioned JSON result contract
├── docs/                     architecture, methodology, and measured examples
├── .github/workflows/        Python and frontend CI
├── package.json              API tools and combined production build
├── vercel.json               build configuration; no automatic deployment performed
└── pyproject.toml            Python package, development tools, pytest, and Ruff
```

The root `pyproject.toml` packages `packages/engine/src/pyop`; install from the
repository root. The engine has no runtime dependencies. pytest, Ruff, and jsonschema
are development dependencies; jsonschema validates the published result contract.

## Install and run

### Frontend and recorded-results API

Use Node.js 22.13+ (recommended) and npm. The app also builds with the existing
Node.js 20.11 workspace runtime; Vite 6 is selected for compatibility with that
runtime. See [Vite 6's requirements](https://v6.vite.dev/guide/).
From the repository root:

```powershell
npm ci
npm ci --prefix apps/web
```

There are two small npm projects with separate lockfiles. Root dependencies support
the API and shared contract; the frontend keeps its existing package and lockfile.
Both installations are required. No Python process, credentials, or environment
variables are needed for the website.

In terminal 1, from the repository root:

```powershell
npm run dev:api
```

In terminal 2, from the repository root:

```powershell
npm run dev:web
```

Open `http://127.0.0.1:5173` (or Vite's printed URL). The local API listens on
`http://127.0.0.1:3001`. Vite forwards `/api` requests to it; browsers use relative,
same-origin URLs with no permissive CORS configuration. If the API is stopped,
the editor still works and demo loading displays a retryable error.

Run checks from the repository root:

```powershell
npm test                            # API contracts and real HTTP tests
npm run lint
npm run typecheck
npm run format:check
npm test --prefix apps/web           # all frontend and HTTP integration tests
npm run lint --prefix apps/web
npm run typecheck --prefix apps/web
npm run format:check --prefix apps/web
npm run build                       # API typecheck/bundles/smoke + frontend build
```

The combined build emits independently runnable API bundles into `.api-build/`
and the static UI into `apps/web/dist`. Vercel compiles the source handlers in
`api/` for deployment; `.api-build/` is a local build verification artifact. With
the project root set to the repository root, `vercel.json` defines installation,
build and output settings. The handlers follow the
[Vercel Web-standard function contract](https://vercel.com/docs/functions/runtimes/node-js).
No deployment, project registration, or cloud-resource creation is performed in Step 3.

### API contract

All successful responses carry `demo: true`. All reported measurements are recordings.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | Health status, `mode: "recorded-demo"`, and `execution_enabled: false` |
| `GET /api/benchmarks` | Supported IDs, workload limits, and available recorded configurations |
| `POST /api/benchmarks/run` | Validate configuration and return a matching recording |

The POST body accepts exactly these three fields; no source code or extra keys:

```json
{"benchmarkId":"duplicates","inputSize":1000,"repetitions":7}
```

Successful POST responses wrap the unchanged schema-v1 result:

```text
{ "demo": true, "result": <original docs/examples record> }
```

Errors share `{ "demo": true, "error": { "code": "...", "message": "..." } }`.
HTTP statuses are 400 for invalid requests/JSON, 404 with `RECORDING_NOT_FOUND` for
valid configurations without a recording, 405 with `Allow` for unsupported methods,
408 for stalled body reads, 413 for oversized bodies, 415 for unsupported media or
compression, and 500 for internal validation/service failures. Query parameters
are not accepted. Infrastructure-level rejections may use the hosting provider's
own responses; the client handles non-JSON responses as errors.

POST bodies must be uncompressed `application/json`, optionally with `charset=utf-8`.
The application counts actual streamed bytes and enforces **1,024 bytes**, even
without a truthful Content-Length. Body reads time out after 5 seconds. The HTTP
client aborts after 10 seconds. Numeric strings, booleans, fractional values,
unknown IDs, extra fields, and values outside workload limits are rejected without
coercion. Input sizes are 0–5,000 for duplicates and 0–28 for Fibonacci; repetitions
are 1–30. These request limits concern recording selection and are independent of
the editor's 7,000-character limit. This API rejects editor code rather than analyzing it.

### Python engine

Requires Python 3.11 or newer. From the existing PyOp workspace, using PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
pyop duplicates --size 1000 --repetitions 7
pyop fibonacci --size 20 --repetitions 7 --warmups 1
python -m pyop fibonacci --size 10
python -m pytest
python -m ruff check .
python -m ruff format --check .
```

Activation is optional: use `.venv\Scripts\python.exe` with `-m pyop`, `-m pytest`,
or `-m ruff`. On Linux/macOS use `source .venv/bin/activate` instead.

With uv installed, `uv sync --extra dev --locked` installs the locked development
environment; prefix commands with `uv run --locked` (for example,
`uv run --locked pyop fibonacci --size 20`). CI tests Python 3.11–3.14 using pip;
the lockfile is available for reproducible local development.

## Implemented functionality

The primary input is a CodeMirror 6 Python editor with syntax highlighting, line
numbers, multiline paste, four-space indentation, undo/redo, and a live character
counter. A transaction filter rejects whole edits beyond **7,000 characters**, keeping
the previous text rather than truncating a paste. The counter uses JavaScript UTF-16
code units, so some Unicode symbols count as two. Tab indents; Escape followed by
Tab moves keyboard focus out of the editor, as described in
[CodeMirror's keyboard guidance](https://codemirror.net/examples/tab/).

Editor text lives in React and CodeMirror memory only. It is lost on reload, never
saved to localStorage or a database, and never passed to a service or executed.
**Run Analysis is disabled** because there is no secure execution backend yet.
Syntax highlighting is not Python syntax validation or performance analysis.

An optional example selector loads readable Duplicate Detection or Fibonacci sample
code into the editor. The interface warns that choosing a sample replaces the editor
text. Samples are illustrative programs, not the source of the displayed timings.
The visible workload-size control has been removed; sizes in the Python engine and
recorded results remain unchanged.

**View Demo Results** is a separate action. It loads the selected example's existing
report using its fixed internal size: Duplicate Detection at 1,000 elements or
Fibonacci at index 20. Both recordings use 7 repetitions and 1 warmup. Other valid
repetition counts show a no-match message. Editor changes do not alter recordings,
and editor text is never submitted with this action.

Reports retain an explicit **Demo Results** label, original/optimized medians,
observed speedup, standard deviation and MAD, interactive median/sample charts,
an accessible chart-data table, and a sortable function-level profile table.
Loading, empty, no-match, and retryable error states remain available. Changing the
selected example or demo repetition count clears the previous report. The UI never
creates fake measurements or silently substitutes another configuration.

`BenchmarkService` remains the frontend boundary. `httpBenchmarkService.ts` is the
default implementation: it explicitly serializes only the three curated configuration
fields, requires the API's demo marker, validates the returned result and verifies
that its configuration matches. Only `RECORDING_NOT_FOUND` becomes an empty state;
other failures are surfaced with retry guidance. It never silently falls back to
local data. The existing `demoBenchmarkService` is retained for offline use and
test injection via `<App service={demoBenchmarkService} />`.

Shared types and runtime validation live in `packages/contracts/src/`; the frontend's
existing type/validation exports remain compatible. The server and browser validate
results against the unchanged JSON Schema. The API imports only the two explicitly
registered recordings; request data never becomes a file path or import. It checks
schema compliance, successful status and sample counts before serving a record.
Ajv is the API's only runtime dependency; no HTTP framework or Vercel SDK is needed.
Frontend runtime dependencies are React, React DOM, Ajv,
and the modular CodeMirror state, view, language, commands, and Python-language
packages, with `@lezer/highlight` for readable dark-theme syntax colors. CodeMirror
is integrated through a React component without an additional
wrapper. Charts use SVG/CSS and native controls without a chart or state-management library.

Speedup is original median divided by optimized median. Values above 1 favor the
optimized implementation; below 1 favor the original. Zero or invalid durations
produce an unavailable ratio. Formatting preserves tiny positive values instead
of implying zero. All performance claims are limited to the recorded run.

The Python engine implements:

| Benchmark ID | Implementations | Meaning of size | Default / maximum |
| --- | --- | --- | --- |
| `duplicates` | Naive list scanning; set-based detection | Number of integer list elements | 1000 / 5000 |
| `fibonacci` | Naive recursion; per-call memoization | Fibonacci index n (F(0)=0) | 20 / 28 |

Both accept size zero. Repetitions range from 1–30 (default 7); warmups from 0–5
(default 1). Duplicate inputs are deterministic pairs `[0, 0, 1, 1, ...]` with a
possible final unique value. They exercise repeated values, rather than every
possible duplicate distribution. The naive implementation includes list slicing
and membership overhead. Duplicate output ordering is ignored during validation.

Each run checks both outputs against an independent reference before any timings.
Inputs are prepared outside measurement. Warmups are untimed; measurement order
alternates each repetition. Memoization starts empty on every invocation, including
warmups, so measurements represent computation rather than a previous result lookup.
One independent `cProfile` run per implementation provides `pstats` function metrics.
Profile times are diagnostic and never substituted for uninstrumented timings.

Results contain Python version, size, repetition and warmup counts, raw nanosecond
samples, median, mean, minimum, maximum, population standard deviation, median
absolute deviation (MAD), function call counts, self time, cumulative time, and
structured errors. The contract is [benchmark-result.schema.json](schemas/benchmark-result.schema.json).
Profile times use seconds. Recursive total calls and primitive calls are separate.
Profile filenames use basenames to avoid disclosing local absolute paths.

The Python entrypoint is `pyop.run_benchmark(...)`; call `.to_dict()` on its result
for JSON serialization. Invalid configuration raises `ValueError`. Workload failures
return `status: "error"` and discard incomplete comparisons. The CLI writes one JSON
object to stdout and exits 0 on success or 1 on configuration/workload failure.
Argument syntax errors use argparse's stderr usage message and exit 2.

Real captured outputs are in [docs/examples](docs/examples). These are observations
on one machine, not performance guarantees. No absolute speed assertions or speedup
claims are built into the tests.

## Architecture and security plan

The currently implemented frontend data path is:

```text
View Demo Results -> HTTP BenchmarkService -> POST /api/benchmarks/run
                                             -> strict validation
                                             -> registered docs/examples/*.json
                                             -> { demo: true, result } -> dashboard

Local development: Vite /api proxy -> Node HTTP adapter -> same Vercel handlers

Python editor -> React / CodeMirror memory only (no execution or network request)
```

The Python CLI runs independently and produces those recordings. No browser-to-Python
connection exists. The future request path is:

```text
React + TypeScript UI → Node.js Vercel Function → isolated Vercel Sandbox
                                                    └→ Python pyop engine
```

The Node.js layer will validate requests and orchestrate isolated work. Untrusted
code must run inside Vercel Sandbox, with outbound networking denied, never inside
ordinary application functions. See the [Vercel Sandbox documentation](https://vercel.com/docs/sandbox)
and [network policy guidance](https://vercel.com/blog/a-sandbox-without-a-network-boundary-is-only-half-a-sandbox).
Custom-code execution stays disabled until this isolation and its independent limits
are implemented and verified. No Sandbox SDK, credentials, paid service, or deployment
is needed for Step 3.

Before exposing custom-code execution, enforce the editor's **7,000-character**
limit independently on the server with consistent counting rules, bounded request
bytes, independent execution timeouts, CPU/memory and
output limits, network denial, concurrency and request-rate limits, abuse prevention,
and sandbox cleanup. Input length alone is not a resource boundary. Review availability,
pricing, and supported isolation controls before enabling a public endpoint.

The engine dispatches only explicitly registered workloads. It does not accept source
code, import paths, shell commands, or serialized Python objects. The curated size caps
limit local work; they are not hard timeouts or a security sandbox. There is no homemade
Python sandbox. Accounts, authentication, personalization, databases, Redis, and saved
history are outside the MVP scope.

## Limitations and next milestone

Single-call wall-clock measurements include call and timer overhead and remain sensitive
to OS scheduling, CPU power state, interpreter, and background activity. Small workloads
can be noisy. Population standard deviation and MAD describe these samples; neither is
a confidence interval. This engine does not measure peak memory, isolate processes,
enforce hard execution limits, or benchmark arbitrary code. Generated inputs are fixed
and existing workloads do not mutate them. New curated workloads must preserve that
property and supply an independent correctness reference.

The UI currently has exactly two recordings. Its arbitrary-code input is editing
only; it offers no live analysis. Profile records include library functions and profiler overhead; cumulative
times overlap. There is no cross-machine normalization, persistent history,
personalization, or deployed endpoint. Automated frontend tests run in a simulated
DOM; they do not replace real browser/device accessibility and layout review.

There are no fresh benchmarks, subprocesses, distributed rate limiter, or cross-origin
API support. The discovery endpoint lists the supported recordings, while the UI
retains its two curated example choices. The local HTTP adapter and bundled handlers
are testable without a Vercel account; Vercel's production routing/build environment
still needs platform verification before deployment. Static `vite preview` alone
does not provide API functions; use the local API and Vite development proxy to test
the connected application.

Next, review the isolated-execution design and define a separate custom-code request
contract, including Vercel Sandbox networking, CPU/memory/output limits, cleanup,
rate/concurrency controls, and failure handling. Do not enable Run Analysis or add
source strings to this recording-selection API until that execution path is verified.
