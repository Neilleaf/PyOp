import { useState, type FormEvent } from 'react';
import { benchmarks } from '../data/benchmarks';
import type { BenchmarkConfiguration, BenchmarkId } from '../types/benchmark';

interface Props {
  loading: boolean;
  onRun: (configuration: BenchmarkConfiguration) => void;
  onConfigurationChange: () => void;
  onSelectSample: (id: BenchmarkId) => void;
}

export function BenchmarkForm({ loading, onRun, onConfigurationChange, onSelectSample }: Props) {
  const [benchmarkId, setBenchmarkId] = useState<BenchmarkId | ''>('');
  const [repetitions, setRepetitions] = useState('7');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!benchmarkId) return;
    onRun({
      benchmarkId,
      inputSize: benchmarks[benchmarkId].defaultSize,
      repetitions: Number(repetitions),
    });
  }

  function selectBenchmark(value: BenchmarkId | '') {
    setBenchmarkId(value);
    onConfigurationChange();
    if (value) onSelectSample(value);
  }

  return (
    <aside className="configuration panel" aria-labelledby="configuration-title">
      <div className="section-heading">
        <span className="step">02</span>
        <h2 id="configuration-title">Explore an example</h2>
      </div>
      <p className="muted">Optional samples and recorded reports.</p>
      <form onSubmit={submit}>
        <fieldset disabled={loading}>
          <label htmlFor="benchmark">Example program (optional)</label>
          <select
            id="benchmark"
            value={benchmarkId}
            aria-describedby="sample-help"
            onChange={(event) => selectBenchmark(event.target.value as BenchmarkId | '')}
          >
            <option value="">Choose a sample…</option>
            {Object.entries(benchmarks).map(([id, item]) => (
              <option key={id} value={id}>
                {item.label} · Sample
              </option>
            ))}
          </select>
          <p id="sample-help" className="field-help">
            Selecting a sample replaces the editor text. Samples are for reading and editing; they
            are not executed.
          </p>
          <label htmlFor="repetitions">Demo repetitions</label>
          <input
            id="repetitions"
            type="number"
            min="1"
            max="30"
            step="1"
            required
            value={repetitions}
            aria-describedby="repetition-help"
            onChange={(event) => {
              setRepetitions(event.target.value);
              onConfigurationChange();
            }}
          />
          <p id="repetition-help" className="field-help">
            Recordings use 7 repetitions. Other values have no demo.
          </p>
          <button className="demo-button" type="submit" disabled={!benchmarkId}>
            {loading ? 'Loading demo…' : 'View Demo Results'}
            <span aria-hidden="true">↗</span>
          </button>
        </fieldset>
        <p className="run-note">Recorded reports are independent of the code in your editor.</p>
      </form>
      <div className="demo-note">
        <span className="eyebrow">RECORDED EXAMPLES</span>
        <p>
          Duplicate Detection · 1,000 elements
          <br />
          Fibonacci · index 20
        </p>
        <p className="muted">
          Each report uses 7 repetitions and 1 warmup. Viewing it never submits editor text.
        </p>
      </div>
    </aside>
  );
}
