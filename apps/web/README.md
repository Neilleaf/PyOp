# PyOp web application

React + TypeScript + Vite input workspace and recorded-demo viewer. First install
the root dependencies with `npm ci` from the repository root, then from this directory:

```powershell
npm ci
npm run dev
npm test
npm run lint
npm run typecheck
npm run format:check
npm run build
```

In another terminal, run `npm run dev:api` from the repository root. Vite proxies
`/api` to `http://127.0.0.1:3001`; no CORS or environment configuration is needed.
The editor itself works offline, but the default demo-report service requires the API.

The main Python editor uses CodeMirror 6 for highlighting, line numbers, indentation,
multiline input and undo/redo. A live counter and transaction filter enforce a
7,000-character limit (JavaScript UTF-16 code units). Oversized edits are rejected
in full. Tab indents; Escape then Tab leaves the editor. Text stays in memory only
and is lost on reload; it is never saved, sent to a backend, or executed.

**Run Analysis is disabled** until secure execution is available. Optional sample
selection replaces the editor text with readable sample code. **View Demo Results**
separately requests captured JSON from the recorded-results API. These reports
are independent of editor content. Internal workload sizes stay fixed; 7 repetitions
matches each recording. Other repetition counts show a no-match message.

Future execution must go through a Node.js Vercel Function into an isolated Vercel
Sandbox, with outbound networking denied and independent code-size, timeout, resource,
output and abuse limits. The Step 3 API serves recordings only; no execution path exists. See the
[root README](../../README.md) for architecture, setup and deployment build settings.

Components:

- `App`: asynchronous loading, empty, error and result states; clears stale reports.
- `PythonEditor`: React-managed CodeMirror instance, live count and disabled analysis.
- `BenchmarkForm`: optional sample selection and independent recorded-report controls.
- `ResultsDashboard`: configuration, median/variability cards and observed speedup.
- `PerformanceChart`: median bars, sample inspection and a chart-data table.
- `ProfileTable`: implementation selection and sortable diagnostic metrics.
- `TechnicalNotes`: measurement context and metric explanations.

`data/benchmarkService.ts` defines the service boundary and retains the local demo
adapter. `data/httpBenchmarkService.ts` implements the default HTTP service. It posts
only the selected benchmark ID, internal recorded size, and repetition count to
`/api/benchmarks/run`. It validates the demo label, result schema and configuration,
and reports API/network errors without substituting local data. Editor text is
deliberately excluded from this service's configuration and explicitly omitted from
request serialization. Result types and validators are shared with the server in
`packages/contracts/src/`. To use local recordings without HTTP, inject
`<App service={demoBenchmarkService} />`; no user code is involved in either adapter.

Tests retain the offline adapter coverage and add HTTP response validation, timeout,
network/error cases and UI-to-API-handler integration. Root tests additionally use
real HTTP sockets to verify the local adapter and byte limits. Root `npm run build`
builds and smoke-tests API bundles before building this frontend.

New editor dependencies: `@codemirror/state`, `@codemirror/view`,
`@codemirror/language`, `@codemirror/commands`, `@codemirror/lang-python`, and
`@lezer/highlight` for the dark syntax color scheme.
No editor framework wrapper, persistence service, or Python runtime is included.
Tests use the real editor with test-only text-range geometry shims because jsdom
has no layout engine. Real browser/device layout and accessibility review is still needed.
