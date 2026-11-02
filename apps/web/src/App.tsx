import { useRef, useState } from 'react';
import { BenchmarkForm } from './components/BenchmarkForm';
import { ResultsDashboard } from './components/ResultsDashboard';
import { TechnicalNotes } from './components/TechnicalNotes';
import { PythonEditor } from './components/PythonEditor';
import { samplePrograms } from './data/samplePrograms';
import type { BenchmarkService } from './data/benchmarkService';
import { httpBenchmarkService } from './data/httpBenchmarkService';
import type { BenchmarkConfiguration, SuccessfulResult } from './types/benchmark';

type ViewState =
  | { kind: 'idle' | 'loading' | 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; result: SuccessfulResult };

export function App({ service = httpBenchmarkService }: { service?: BenchmarkService }) {
  const [state, setState] = useState<ViewState>({ kind: 'idle' });
  const [code, setCode] = useState('');
  const request = useRef(0);

  function reset() {
    request.current += 1;
    setState({ kind: 'idle' });
  }

  async function run(configuration: BenchmarkConfiguration) {
    const current = ++request.current;
    setState({ kind: 'loading' });
    try {
      const result = await service.load(configuration);
      if (current !== request.current) return;
      if (result === null) setState({ kind: 'empty' });
      else if (result.status === 'error') {
        setState({
          kind: 'error',
          message: result.errors.map((error) => `${error.phase}: ${error.message}`).join(' · '),
        });
      } else setState({ kind: 'success', result });
    } catch (error) {
      if (current === request.current)
        setState({
          kind: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'The demo could not be loaded. Please try again.',
        });
    }
  }

  return (
    <>
      <a className="skip-link" href="#workspace">
        Skip to benchmark workspace
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#" aria-label="PyOp home">
            <span className="brand-mark" aria-hidden="true">
              ⌁
            </span>
            PyOp
            <span className="brand-divider" />{' '}
            <span className="brand-description">Python Optimizer</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#workspace">Workspace</a>
            <a href="#methodology">Methodology</a>
            <span className="version">v0.1 / DEMO</span>
          </nav>
        </div>
      </header>
      <main className="page-shell">
        <section className="hero" aria-labelledby="page-title">
          <div>
            <span className="eyebrow hero-eyebrow">
              <span className="status-dot" /> THE PYTHON PERFORMANCE WORKSPACE
            </span>
            <h1 id="page-title">
              Less guesswork.
              <br />
              <span>More evidence.</span>
            </h1>
            <p className="subtitle">Profile Python. Find bottlenecks. Optimize with evidence.</p>
            <p className="hero-description">
              Prepare your Python code in the editor. Explore optional examples and recorded
              benchmark reports while secure execution is being built.
            </p>
          </div>
          <div className="hero-aside">
            <span className="terminal-label">MEASURE → UNDERSTAND → IMPROVE</span>
            <div className="terminal-line">
              <span>01</span> correct outputs<span className="terminal-check">✓</span>
            </div>
            <div className="terminal-line">
              <span>02</span> repeated timings<span className="terminal-check">✓</span>
            </div>
            <div className="terminal-line">
              <span>03</span> actionable profiles<span className="terminal-check">✓</span>
            </div>
          </div>
        </section>
        <div className="demo-banner">
          <span className="badge">DEMO MODE</span>
          <p>
            Code editor available. Custom-code execution coming later.{' '}
            <span>View Demo Results opens a recorded report, independent of your editor text.</span>
          </p>
        </div>
        <div id="workspace" className="workspace">
          <PythonEditor value={code} onChange={setCode} />
          <BenchmarkForm
            loading={state.kind === 'loading'}
            onRun={run}
            onConfigurationChange={reset}
            onSelectSample={(id) => setCode(samplePrograms[id])}
          />
          <section
            className="report-area"
            aria-labelledby="report-title"
            aria-busy={state.kind === 'loading'}
          >
            <div className="section-heading report-label">
              <span className="step">03</span>
              <h2 id="report-title">Recorded demo reports</h2>
              <span className="local-label">CURATED / READ ONLY</span>
            </div>
            <p className="report-disclaimer">
              Reports are never generated from your editor text. These are previously recorded
              benchmark runs.
            </p>
            <div className="sr-only" role="status">
              {state.kind === 'success'
                ? 'Demo Results loaded.'
                : state.kind === 'loading'
                  ? 'Loading demo results.'
                  : ''}
            </div>
            {state.kind === 'success' ? (
              <ResultsDashboard
                key={`${state.result.benchmark_id}-${state.result.input_size}-${state.result.repetitions}`}
                result={state.result}
              />
            ) : (
              <div
                className={`panel empty-state ${state.kind === 'error' ? 'error-state' : ''}`}
                role={state.kind === 'error' ? 'alert' : 'status'}
              >
                <span className="empty-icon" aria-hidden="true">
                  {state.kind === 'loading' ? '↻' : state.kind === 'error' ? '!' : '⌁'}
                </span>
                <span className="eyebrow">
                  {state.kind === 'loading'
                    ? 'LOADING RECORDED DATA'
                    : state.kind === 'empty'
                      ? 'NO MATCHING RECORDING'
                      : state.kind === 'error'
                        ? 'DEMO COULD NOT LOAD'
                        : 'READY WHEN YOU ARE'}
                </span>
                <h3>
                  {state.kind === 'loading'
                    ? 'Opening the demo report…'
                    : state.kind === 'empty'
                      ? 'No demo for this configuration.'
                      : state.kind === 'error'
                        ? 'The recorded report could not load.'
                        : 'Explore a recorded report.'}
                </h3>
                <p>
                  {state.kind === 'loading'
                    ? 'Loading a recorded example, without running Python.'
                    : state.kind === 'empty'
                      ? 'Choose an optional example and use 7 demo repetitions. No new measurements have been generated.'
                      : state.kind === 'error'
                        ? state.message
                        : 'Select an optional example and View Demo Results to inspect an existing recording. Reports are never generated from your editor text.'}
                </p>
                {state.kind === 'idle' && (
                  <div className="empty-details">
                    <span>2 curated workloads</span>
                    <span>Real timing samples</span>
                    <span>Correctness verified</span>
                  </div>
                )}
                {state.kind === 'error' && (
                  <p className="small muted">
                    Adjust the demo configuration or select View Demo Results to retry.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
        <TechnicalNotes />
      </main>
      <footer className="footer">
        <span>
          <strong>PyOp</strong> / Built to measure, not to guess.
        </span>
        <span>Python editor + recorded-demo API · Step 3</span>
      </footer>
    </>
  );
}
